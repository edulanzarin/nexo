import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { balanceteFiscal, calibrarPorNatureza, CONTA_CONTRAPARTIDA } from "@/lib/balancete-fiscal";
import { pendentesNfse } from "@/lib/balancete-pendentes";
import type { BalanceteFiscalResp, BalanceteLinha } from "@/lib/types";

/**
 * Balancete FISCAL: a movimentação de débito/crédito que as notas DEVERIAM
 * gerar pelas regras (motor), lado a lado com a movimentação REAL de origem
 * fiscal (o que o Questor de fato lançou), na árvore do plano de contas. A
 * diferença por conta aponta valor que foi parar na conta errada.
 *
 * Escopo (opção 2): movimento nota a nota (ME/MS). O motor só lança nas contas
 * que de fato aparecem no ME real (as de apuração mensal ficam de fora); os
 * componentes que não dá pra avaliar contam na cobertura. A contrapartida
 * variável (fornecedor/cliente) fica fora da árvore comparativa por ora.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) throw new FilterError("Selecione uma empresa para o balancete");
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    const p = [empresa, f.inicio, f.fim] as const;
    // Filial: recorta os DOIS lados do espelho (real e fiscal) igual, senão a
    // reconciliação desalinha. Vazio = todas (consolidado).
    const temEstab = f.estabs.length > 0;
    const estabReal = temEstab ? ` and codigoestab = any($4::int[])` : "";
    const realParams = temEstab ? [...p, f.estabs] : [...p];

    // Movimento REAL de TODA origem fiscal (notas ME/MS + consolidações MOV +
    // apuração IM + retenção RE) — pra o Contábil ficar completo: varejo vende
    // muito por cupom consolidado (origem MOV), que não é nota individual. Por
    // CHAVE (não só por conta): o espelho decide por NOTA o que espelhar.
    const real = await client.query<{ conta: number; natureza: number; chaveorigem: string; valor: number }>(
      `select contactbdeb conta, 1 natureza, chaveorigem, sum(valorlctoctb)::float valor
         from lctoctb where codigoempresa=$1 and codigooriglctoctb='FI'
           and datalctoctb between $2 and $3 and contactbdeb is not null${estabReal}
        group by contactbdeb, chaveorigem
       union all
       select contactbcred, -1, chaveorigem, sum(valorlctoctb)::float
         from lctoctb where codigoempresa=$1 and codigooriglctoctb='FI'
           and datalctoctb between $2 and $3 and contactbcred is not null${estabReal}
        group by contactbcred, chaveorigem`,
      realParams
    );
    const NOTA_RE = /^(M[ES])0*(\d+)$/;
    const realPorConta = new Map<number, { deb: number; cred: number }>();
    const observadas = new Set<string>();
    // Notas COM lançamento por nota no real (ME/MS) — consolidada/pendente ficam fora.
    const lancadas = new Set<string>();
    for (const r of real.rows) {
      const a = realPorConta.get(r.conta) ?? { deb: 0, cred: 0 };
      if (r.natureza === 1) a.deb += r.valor;
      else a.cred += r.valor;
      realPorConta.set(r.conta, a);
      // Só as NOTAS calibram o motor. Apuração/consolidação ficam fora, senão o
      // motor geraria imposto que na verdade é da apuração mensal.
      const m = NOTA_RE.exec(r.chaveorigem);
      if (m) {
        observadas.add(`${r.natureza}:${r.conta}`);
        lancadas.add(`${m[1]}:${m[2]}`);
      }
    }

    // Movimento FISCAL (hipotético) — entradas + saídas. `produzidas` recebe
    // "origem:chave:natureza" das notas que o motor reproduziu (o espelho as usa).
    const produzidas = new Set<string>();
    // Notas de natureza de serviço sem regra de conta — espelham sempre.
    const semRegraConta = new Set<string>();
    const observadasPorNatureza = await calibrarPorNatureza(client, empresa, f.inicio, f.fim, f.estabs);
    const comum = { observadas, observadasPorNatureza, produzidas, lancadas, estabs: f.estabs, semRegraConta };
    const [ent, sai] = await Promise.all([
      balanceteFiscal(client, empresa, f.inicio, f.fim, "ent", comum),
      balanceteFiscal(client, empresa, f.inicio, f.fim, "sai", comum),
    ]);
    const fiscalPorConta = new Map<number, { deb: number; cred: number }>();
    for (const mov of [ent, sai]) {
      for (const [conta, m] of mov.porConta) {
        if (conta === CONTA_CONTRAPARTIDA) continue; // fora da árvore por ora
        const a = fiscalPorConta.get(conta) ?? { deb: 0, cred: 0 };
        a.deb += m.debito;
        a.cred += m.credito;
        fiscalPorConta.set(conta, a);
      }
    }
    // Espelho do real no fiscal — o que o motor NÃO reproduz entra com o próprio
    // real (fiscal = real, sem falso positivo): consolidação (MOV), apuração
    // (IM), retenção (RE), contrapartida fornecedor/cliente, NFSE sem fórmula.
    // Três exclusões — a primeira manda nas outras duas:
    // 0. Por NOTA, sem regra: natureza de serviço genérica (a conta se decide na
    //    nota) espelha sempre, mesmo em conta regrada. Sem isto ela ficaria sem
    //    contrapartida no fiscal e a conta acusaria uma falta do tamanho dela.
    // 1. Por CONTA: conta que o motor movimenta é comparação, não espelho.
    // 2. Por NOTA: nota que o motor reproduziu não é espelhada em conta NENHUMA —
    //    a versão do motor a substitui. É o que faz conta errada aparecer: a
    //    conta do plano fica com a nota a mais (+), a conta onde o contábil de
    //    fato lançou fica com ela a menos (−), e as duas se anulam no total
    //    (o dinheiro não some, muda de conta) sem dobrar o débito.
    const regrada = new Set<string>();
    for (const [conta, m] of fiscalPorConta) {
      if (m.deb > 0.005) regrada.add(`1:${conta}`);
      if (m.cred > 0.005) regrada.add(`-1:${conta}`);
    }
    for (const r of real.rows) {
      const m = NOTA_RE.exec(r.chaveorigem);
      if (
        m &&
        !semRegraConta.has(`${m[1]}:${m[2]}`) &&
        (regrada.has(`${r.natureza}:${r.conta}`) ||
          produzidas.has(`${m[1]}:${m[2]}:${r.natureza}`))
      ) {
        continue;
      }
      const a = fiscalPorConta.get(r.conta) ?? { deb: 0, cred: 0 };
      if (r.natureza === 1) a.deb += r.valor;
      else a.cred += r.valor;
      fiscalPorConta.set(r.conta, a);
    }

    // NFSE obrigada mas NÃO contabilizada: o motor não a reproduz (sem CFOP) e
    // não há real pra espelhar, então ela sumiria. Injeta o valor no esperado na
    // conta prevista pela história do fornecedor — cria a divergência que o real
    // não tem (só onde falta lançamento, então sem falso positivo).
    const pendentes = await pendentesNfse(client, empresa, f.inicio, f.fim, f.estabs);
    for (const pd of pendentes) {
      if (pd.conta == null) continue; // sem histórico: fica só no painel, não na árvore
      const a = fiscalPorConta.get(pd.conta) ?? { deb: 0, cred: 0 };
      if (pd.natureza === 1) a.deb += pd.valor;
      else a.cred += pd.valor;
      fiscalPorConta.set(pd.conta, a);
    }

    // Plano de contas (para nome, classificação e sintética × analítica).
    const contasEnvolvidas = new Set<number>([...fiscalPorConta.keys(), ...realPorConta.keys()]);
    const plano = await client.query<{
      conta: number;
      classif: string;
      descr: string | null;
      tipoconta: number;
    }>(
      `select contactb conta, classifconta classif, descrconta descr, tipoconta
         from planoespec where codigoempresa=$1`,
      [empresa]
    );
    const infoConta = new Map<number, { classif: string; descr: string | null; sintetica: boolean }>();
    const sinteticas = new Set<string>();
    for (const r of plano.rows) {
      infoConta.set(r.conta, {
        classif: r.classif,
        descr: r.descr,
        sintetica: r.tipoconta === 1,
      });
      if (r.tipoconta === 1) sinteticas.add(r.classif);
    }

    // Rollup: cada analítica com movimento soma nas sintéticas ancestrais (prefixo).
    const acumSint = new Map<string, { fd: number; fc: number; rd: number; rc: number }>();
    const bump = (classif: string, fd: number, fc: number, rd: number, rc: number) => {
      const a = acumSint.get(classif) ?? { fd: 0, fc: 0, rd: 0, rc: 0 };
      a.fd += fd;
      a.fc += fc;
      a.rd += rd;
      a.rc += rc;
      acumSint.set(classif, a);
    };
    for (const conta of contasEnvolvidas) {
      const info = infoConta.get(conta);
      if (!info || info.sintetica) continue; // só analítica gera movimento
      const fis = fiscalPorConta.get(conta) ?? { deb: 0, cred: 0 };
      const re = realPorConta.get(conta) ?? { deb: 0, cred: 0 };
      const seg = info.classif.split(".");
      for (let k = 1; k < seg.length; k++) {
        const prefixo = seg.slice(0, k).join(".");
        if (sinteticas.has(prefixo)) bump(prefixo, fis.deb, fis.cred, re.deb, re.cred);
      }
    }

    // Monta as linhas: sintéticas (com rollup) + analíticas (movimento próprio).
    const linhas: BalanceteLinha[] = [];
    for (const [conta, info] of infoConta) {
      const nivel = info.classif.split(".").length;
      if (info.sintetica) {
        const a = acumSint.get(info.classif);
        if (!a || (a.fd === 0 && a.fc === 0 && a.rd === 0 && a.rc === 0)) continue;
        linhas.push({
          conta,
          classif: info.classif,
          nivel,
          descricao: info.descr ?? String(conta),
          sintetica: true,
          fiscalDeb: a.fd,
          fiscalCred: a.fc,
          realDeb: a.rd,
          realCred: a.rc,
        });
      } else {
        if (!contasEnvolvidas.has(conta)) continue;
        const fis = fiscalPorConta.get(conta) ?? { deb: 0, cred: 0 };
        const re = realPorConta.get(conta) ?? { deb: 0, cred: 0 };
        if (fis.deb === 0 && fis.cred === 0 && re.deb === 0 && re.cred === 0) continue;
        linhas.push({
          conta,
          classif: info.classif,
          nivel,
          descricao: info.descr ?? String(conta),
          sintetica: false,
          fiscalDeb: fis.deb,
          fiscalCred: fis.cred,
          realDeb: re.deb,
          realCred: re.cred,
        });
      }
    }
    linhas.sort((a, b) => a.classif.localeCompare(b.classif) || a.conta - b.conta);

    return {
      linhas,
      cobertura: {
        notas: ent.notas + sai.notas,
        componentesPulados: ent.pulados + sai.pulados,
      },
      nivelMax: linhas.reduce((mx, l) => Math.max(mx, l.nivel), 1),
      pendentes: pendentes.map((pd) => ({
        chave: pd.chave,
        numero: pd.numero,
        data: pd.data,
        contraparte: pd.contraparte,
        origem: pd.origem,
        valor: pd.valor,
        conta: pd.conta,
        contaDescr: pd.contaDescr,
      })),
    } satisfies BalanceteFiscalResp;
  } finally {
    client.release();
  }
});
