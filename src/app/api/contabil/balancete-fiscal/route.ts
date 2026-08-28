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
    // `contraconta` e `historico` = o outro lado da MESMA linha e o carimbo da
    // regra que a gerou. Juntos acham, na apuração, o lançamento que corresponde
    // ao componente mensal (o par 382/2835 com o histórico da devolução) sem
    // varrer junto o ajuste que alguém lançou à mão no mesmo par de contas.
    const real = await client.query<{
      conta: number;
      natureza: number;
      chaveorigem: string;
      contraconta: number | null;
      historico: number | null;
      valor: number;
    }>(
      `select contactbdeb conta, 1 natureza, chaveorigem, contactbcred contraconta,
              codigohistctb historico, sum(valorlctoctb)::float valor
         from lctoctb where codigoempresa=$1 and codigooriglctoctb='FI'
           and datalctoctb between $2 and $3 and contactbdeb is not null${estabReal}
        group by contactbdeb, chaveorigem, contactbcred, codigohistctb
       union all
       select contactbcred, -1, chaveorigem, contactbdeb, codigohistctb,
              sum(valorlctoctb)::float
         from lctoctb where codigoempresa=$1 and codigooriglctoctb='FI'
           and datalctoctb between $2 and $3 and contactbcred is not null${estabReal}
        group by contactbcred, chaveorigem, contactbdeb, codigohistctb`,
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
    // Espelho por NOTA E CONTA: o que o motor reproduziu não espelha, o que ele
    // não conseguiu reproduzir espelha, e o resto segue a regra por conta.
    const porNotaConta = {
      produzidas: new Set<string>(),
      puladas: new Set<string>(),
      principal: new Map<string, number>(),
    };
    const observadasPorNatureza = await calibrarPorNatureza(client, empresa, f.inicio, f.fim, f.estabs);
    const comum = {
      observadas, observadasPorNatureza, produzidas, lancadas,
      estabs: f.estabs, semRegraConta, porNotaConta,
    };
    const [ent, sai] = await Promise.all([
      balanceteFiscal(client, empresa, f.inicio, f.fim, "ent", comum),
      balanceteFiscal(client, empresa, f.inicio, f.fim, "sai", comum),
    ]);
    // O que cada natureza deve à conta no mês inteiro (componente que fecha na
    // apuração). Substitui o espelho da linha correspondente — ver abaixo.
    const agregado = new Map<string, { valor: number; irmas: number[]; encontrada: boolean }>();
    for (const mov of [ent, sai]) {
      for (const [k, a] of mov.agregado) {
        // Componente sem conta irmã (a contrapartida é o fornecedor/cliente) não
        // é de apuração: não há par a procurar, então não vira soma do mês.
        if (!a.irmas.length) continue;
        const atual = agregado.get(k);
        if (atual) {
          atual.valor += a.valor;
          for (const i of a.irmas) if (!atual.irmas.includes(i)) atual.irmas.push(i);
        } else agregado.set(k, { valor: a.valor, irmas: [...a.irmas], encontrada: false });
      }
    }

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
    // O espelho decide por NOTA, nunca por conta:
    // 0. Por NOTA, sem regra: natureza de serviço genérica (a conta se decide na
    //    nota) espelha sempre, mesmo em conta regrada. Sem isto ela ficaria sem
    //    contrapartida no fiscal e a conta acusaria uma falta do tamanho dela.
    // 1. Por NOTA e CONTA: onde ele pôs, não espelha; onde o plano mandava e ele
    //    não soube reproduzir, espelha.
    // 2. Por NOTA: nota cuja perna principal ele reproduziu não é espelhada em
    //    conta NENHUMA —
    //    a versão do motor a substitui. É o que faz conta errada aparecer: a
    //    conta do plano fica com a nota a mais (+), a conta onde o contábil de
    //    fato lançou fica com ela a menos (−), e as duas se anulam no total
    //    (o dinheiro não some, muda de conta) sem dobrar o débito.
    /**
     * Casa cada componente mensal com a linha da apuração que o corresponde, em
     * DUAS passadas sobre o real (nota fica de fora, é outro fluxo):
     *
     * 1. pelo HISTÓRICO da regra — é ele que separa a apuração do ajuste que
     *    alguém lançou à mão no mesmo par de contas (na 2827/1541 convivem a
     *    apuração do mês e "VLR ICMS S/REMESSA", que o motor não reproduz);
     * 2. só pelo par de contas, e apenas para o componente que a primeira passada
     *    não achou — há empresa cuja apuração entra por importação e carimba
     *    histórico 0 em tudo, e ali o histórico não separa nada.
     *
     * A ordem importa: fazer a segunda passada sem a primeira faria o ajuste
     * manual ser lido como se fosse a apuração, e a diferença apareceria
     * invertida, do tamanho do ajuste.
     *
     * Componente que não casa em nenhuma das duas NÃO vira expectativa: a soma
     * iria contra um zero que só diz que não sabemos onde ela foi parar. Fica em
     * `semApuracao`, para a tela dizer o que deixou de ser conferido — silêncio
     * sobre o que não foi conferido lê-se como "conferido".
     */
    const consumidas = new Set<number>();
    const casar = (estrito: boolean) => {
      real.rows.forEach((r, i) => {
        if (consumidas.has(i) || r.contraconta == null) return;
        if (NOTA_RE.test(r.chaveorigem)) return;
        const prefixo = estrito
          ? `${r.natureza}:${r.conta}:${r.historico ?? 0}:`
          : `${r.natureza}:${r.conta}:`;
        for (const [k, a] of agregado) {
          if (!k.startsWith(prefixo)) continue;
          if (!estrito && a.encontrada) continue;
          if (!a.irmas.includes(r.contraconta)) continue;
          a.encontrada = true;
          consumidas.add(i);
          return;
        }
      });
    };
    casar(true);
    casar(false);

    const mirror = (r: { conta: number; natureza: number; valor: number }) => {
      const a = fiscalPorConta.get(r.conta) ?? { deb: 0, cred: 0 };
      if (r.natureza === 1) a.deb += r.valor;
      else a.cred += r.valor;
      fiscalPorConta.set(r.conta, a);
    };
    real.rows.forEach((r, i) => {
      const m = NOTA_RE.exec(r.chaveorigem);
      if (m) {
        const nc = `${m[1]}:${m[2]}:${r.natureza}:${r.conta}`;
        // O motor pôs a nota AQUI: a versão dele substitui o real. Vale mesmo em
        // nota "sem regra de conta" — a natureza não tem regra para a DESPESA,
        // mas as pernas de imposto que ele reproduziu continuam valendo, e
        // espelhá-las junto contava o mesmo lançamento duas vezes.
        if (porNotaConta.produzidas.has(nc)) return;
        if (semRegraConta.has(`${m[1]}:${m[2]}`)) return void mirror(r);
        // O plano manda a nota aqui e o motor não soube reproduzir: espelha, ou
        // a conta acusa uma falta que é do motor, não do lançamento.
        // A perna principal desta nota foi reproduzida e caiu em OUTRA conta:
        // aquela perna não espelha, e é isso que faz a conta errada aparecer
        // como PAR — a certa com o esperado sem real, a errada com o real sem
        // esperado. Só a perna: o resto da nota não é da regra e espelha.
        const pr = porNotaConta.principal.get(`${m[1]}:${m[2]}:${r.natureza}`);
        if (!porNotaConta.puladas.has(nc) && pr != null && Math.abs(Math.abs(r.valor) - pr) < 0.02) {
          return;
        }
      }
      // Lançamento de apuração que o motor sabe recompor: não espelha — quem
      // entra no lado fiscal é a soma do período, e a diferença entre as duas
      // é justamente o que a apuração deixou de lançar.
      if (consumidas.has(i)) return;
      mirror(r);
    });

    // A soma do período entra no lado fiscal no lugar do que foi espelhado —
    // só onde a apuração correspondente foi encontrada (ver `casar`).
    for (const [k, a] of agregado) {
      if (!a.encontrada) continue;
      const conta = Number(k.split(":")[1]);
      const alvo = fiscalPorConta.get(conta) ?? { deb: 0, cred: 0 };
      if (k.startsWith("1:")) alvo.deb += a.valor;
      else alvo.cred += a.valor;
      fiscalPorConta.set(conta, alvo);
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
      semApuracao: [...agregado]
        .filter(([, a]) => !a.encontrada)
        .map(([k, a]) => ({
          conta: Number(k.split(":")[1]),
          natureza: (k.startsWith("1:") ? 1 : -1) as 1 | -1,
          esperado: a.valor,
        })),
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
