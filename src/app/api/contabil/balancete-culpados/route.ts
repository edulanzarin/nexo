import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { balanceteFiscal, calibrarPorNatureza, type DetalheFiscal } from "@/lib/balancete-fiscal";
import { contasDoAlvo } from "@/lib/plano-contabil";
import type { BalanceteCulpado, BalanceteCulpadosResp } from "@/lib/types";

/** Centavos de tolerância — rateio/arredondamento não é diferença de verdade. */
const TOL = 0.5;

/**
 * Notas por trás da diferença de uma conta no balancete (aba Diferenças): por
 * nota, o líquido (débito − crédito) que o motor ESPERAVA na conta × o que o
 * contábil de fato lançou. Quem tem `esperado ≠ real` puxa a diferença; a soma
 * das diferenças fecha com a coluna Diferença da conta.
 *
 * Só faz sentido em conta com regra (o motor movimenta) — que é justamente onde
 * pode haver diferença: conta sem regra espelha o real e nunca diverge.
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp);
  if (f.empresas.length !== 1) throw new FilterError("Selecione uma empresa");
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);
  const classif = (sp.get("classif") ?? "").trim();
  if (!classif) throw new FilterError("classif é obrigatório");
  const conta = Number(sp.get("conta") ?? 0);
  const sintetica = sp.get("sintetica") === "1";

  const client = await pool.connect();
  try {
    const contas = await contasDoAlvo(client, empresa, classif, sintetica, conta);
    if (!contas.length) return { culpados: [], total: 0 } satisfies BalanceteCulpadosResp;
    // Filial: recorta calibração, motor e o real por nota — tudo igual à célula.
    const temEstab = f.estabs.length > 0;
    const estabObs = temEstab ? ` and codigoestab = any($4::int[])` : "";
    const obsParams = temEstab ? [empresa, f.inicio, f.fim, f.estabs] : [empresa, f.inicio, f.fim];
    const estabReal = temEstab ? ` and l.codigoestab = any($5::int[])` : "";

    // Contas (por natureza) que recebem lançamento por nota — calibra o motor.
    // Da empresa INTEIRA (não só o alvo), pra rodar idêntico ao da célula do
    // balancete; a mesma query dá as `lancadas` (notas lançadas por nota).
    const obsRows = await client.query<{ conta: number; nat: number; chaveorigem: string }>(
      `select contactbdeb conta, 1 nat, chaveorigem from lctoctb
         where codigoempresa=$1 and codigooriglctoctb='FI' and datalctoctb between $2 and $3
           and contactbdeb is not null and chaveorigem ~ '^M[ES][0-9]+$'${estabObs}
        group by contactbdeb, chaveorigem
       union all
       select contactbcred, -1, chaveorigem from lctoctb
         where codigoempresa=$1 and codigooriglctoctb='FI' and datalctoctb between $2 and $3
           and contactbcred is not null and chaveorigem ~ '^M[ES][0-9]+$'${estabObs}
        group by contactbcred, chaveorigem`,
      obsParams
    );
    const NOTA_RE = /^(M[ES])0*(\d+)$/;
    const observadas = new Set<string>();
    const lancadas = new Set<string>();
    for (const r of obsRows.rows) {
      observadas.add(`${r.nat}:${r.conta}`);
      const m = NOTA_RE.exec(r.chaveorigem);
      if (m) lancadas.add(`${m[1]}:${m[2]}`);
    }

    // ESPERADO (líquido, por nota) — o motor replaya cada nota nas contas alvo.
    // `produzidas` acumula "origem:chave" de nota reproduzida em qualquer conta
    // (e "origem:chave:natureza" quando de fato produziu — o espelho por nota).
    const contasSet = new Set(contas);
    const produzidas = new Set<string>();
    const mk = (): DetalheFiscal => ({
      contas: contasSet,
      natureza: 1,
      net: true,
      porNota: new Map(),
      regradas: new Set(),
    });
    const detEnt = mk();
    const detSai = mk();
    // Conta que o plano manda por nota — a "certa", mesmo fora do alvo.
    const producao = new Map<string, { conta: number; valor: number }>();
    // Notas de natureza de serviço sem regra de conta: espelham na célula, logo
    // não carregam diferença — e por isso não podem aparecer aqui, senão a soma
    // da lista deixa de fechar com a coluna Diferença.
    const semRegraConta = new Set<string>();
    // Contrapartida de fornecedor/cliente: conta que nasce no lançamento, então
    // nota lançada ali não é "conta errada".
    const contrapartidaVariavel = new Set<string>();
    // Nota que o motor só reproduziu pela metade (token de fase 2): não dá para
    // concluir nada comparando contas.
    const incompletas = new Set<string>();
    // Mesmo critério de espelho da célula — por NOTA E CONTA.
    const porNotaConta = { produzidas: new Set<string>(), puladas: new Set<string>() };
    const observadasPorNatureza = await calibrarPorNatureza(client, empresa, f.inicio, f.fim, f.estabs);
    const comum = {
      observadas, observadasPorNatureza, produzidas, lancadas, producao,
      estabs: f.estabs, semRegraConta, contrapartidaVariavel, incompletas, porNotaConta,
    };
    const movEnt = await balanceteFiscal(client, empresa, f.inicio, f.fim, "ent", { ...comum, detalhe: detEnt });
    const movSai = await balanceteFiscal(client, empresa, f.inicio, f.fim, "sai", { ...comum, detalhe: detSai });

    // Só as contas que o motor de fato REGRA entram na comparação: conta sem
    // regra espelha o real (fiscal = real), então não tem diferença — incluí-la
    // (numa sintética, p.ex.) contaria o real dela como falsa diferença.
    const regradasSet = new Set<number>([...detEnt.regradas, ...detSai.regradas]);

    // REAL por nota, itemizado por conta E natureza, em TODAS as contas alvo (não
    // só as regradas): o líquido (para a diferença) segue a MESMA regra do espelho
    // da célula — conta regrada OU nota que o motor reproduziu naquela natureza —,
    // e a CONTA onde a nota bate vem de todas, pra mostrar que um "faltando" na
    // verdade foi lançado noutra conta do alvo (conta errada), não sumiu.
    const realRows = (
      await client.query<{ origem: string; chave: number; conta: number; nat: number; numero: number | null; especie: string | null; contraparte: string | null; net: number }>(
        `with r as (
           select substring(l.chaveorigem for 2) origem,
                  substring(l.chaveorigem from 3)::bigint chave,
                  l.contactbdeb conta, 1 nat, coalesce(l.valorlctoctb,0)::float net
             from lctoctb l
            where l.codigoempresa=$1 and l.codigooriglctoctb='FI' and l.datalctoctb between $2 and $3
              and l.chaveorigem ~ '^M[ES][0-9]+$' and l.contactbdeb = any($4::bigint[])${estabReal}
           union all
           select substring(l.chaveorigem for 2), substring(l.chaveorigem from 3)::bigint,
                  l.contactbcred, -1, -coalesce(l.valorlctoctb,0)::float
             from lctoctb l
            where l.codigoempresa=$1 and l.codigooriglctoctb='FI' and l.datalctoctb between $2 and $3
              and l.chaveorigem ~ '^M[ES][0-9]+$' and l.contactbcred = any($4::bigint[])${estabReal}
         )
         select r.origem, r.chave, r.conta, r.nat, sum(r.net)::float net,
                coalesce(e.numeronf, s.numeronf) numero,
                upper(btrim(coalesce(e.especienf, s.especienf))) especie,
                coalesce(pe.nomepessoa, ps.nomepessoa) contraparte
           from r
           left join lctofisent e on r.origem='ME' and e.codigoempresa=$1 and e.chavelctofisent=r.chave
           left join lctofissai s on r.origem='MS' and s.codigoempresa=$1 and s.chavelctofissai=r.chave
           left join pessoa pe on pe.codigopessoa=e.codigopessoa
           left join pessoa ps on ps.codigopessoa=s.codigopessoa
          group by r.origem, r.chave, r.conta, r.nat, e.numeronf, s.numeronf, e.especienf, s.especienf, pe.nomepessoa, ps.nomepessoa`,
        temEstab ? [empresa, f.inicio, f.fim, contas, f.estabs] : [empresa, f.inicio, f.fim, contas]
      )
        ).rows;

    // Junta esperado × real por (origem, chave). `contaReal` = conta analítica onde
    // a nota mais bate no real; `contaEsp` = onde o motor a esperou. Uma delas
    // representa a nota no detalhe (útil ao abrir uma sintética).
    type Ac = {
      origem: string;
      chave: number;
      numero: number | null;
      especie: string | null;
      contraparte: string | null;
      esperado: number;
      real: number;
      contaReal: number | null;
      contaRealAbs: number;
      contaEsp: number | null;
      /** Todas as contas do alvo onde o motor esperou a nota. */
      contasEsp: Set<number>;
    };
    const mapa = new Map<string, Ac>();
    const pega = (
      origem: string,
      chave: number,
      numero: number | null,
      especie: string | null,
      contraparte: string | null
    ) => {
      const k = `${origem}:${chave}`;
      let a = mapa.get(k);
      if (!a) {
        a = { origem, chave, numero, especie, contraparte, esperado: 0, real: 0, contaReal: null, contaRealAbs: 0, contaEsp: null, contasEsp: new Set() };
        mapa.set(k, a);
      }
      if (a.numero == null && numero != null) a.numero = numero;
      if (!a.especie && especie) a.especie = especie;
      if (!a.contraparte && contraparte) a.contraparte = contraparte;
      return a;
    };
    for (const det of [detEnt, detSai]) {
      for (const n of det.porNota.values()) {
        const a = pega(n.origem, n.chave, n.numero, n.especie, n.contraparte);
        a.esperado += n.valor;
        if (a.contaEsp == null) a.contaEsp = n.conta;
        for (const c of n.contas) a.contasEsp.add(c);
      }
    }
    for (const r of realRows) {
      const a = pega(r.origem, r.chave, r.numero, r.especie, r.contraparte);
      // Líquido pela MESMA regra do espelho da célula (por nota e conta): o que
      // espelha não entra na comparação — espelhado é fiscal = real, diferença
      // zero. Divergir daqui é a lista deixar de fechar com a coluna Diferença.
      const nc = `${r.origem}:${r.chave}:${r.nat}:${r.conta}`;
      const espelhado = porNotaConta.produzidas.has(nc)
        ? false
        : porNotaConta.puladas.has(nc) ||
          !(regradasSet.has(r.conta) || produzidas.has(`${r.origem}:${r.chave}:${r.nat}`));
      if (!espelhado) a.real += r.net;
      // …e a conta onde a nota mais bate vem de TODAS as contas alvo — menos a
      // contrapartida variável: o plano manda a nota cair na conta do
      // fornecedor/cliente, então ela ali é o certo, e apontá-la como "a conta
      // onde foi parar" transformava o acerto em acusação.
      const variavel = contrapartidaVariavel.has(`${r.origem}:${r.chave}:${r.nat}`);
      if (!variavel && Math.abs(r.net) > a.contaRealAbs) {
        a.contaRealAbs = Math.abs(r.net);
        a.contaReal = r.conta;
      }
    }

    // Componente que a natureza fecha na apuração mensal: entra na lista como
    // UMA linha (não é nota), senão a soma da lista não fecha com a célula.
    const agregado = new Map<string, { valor: number; irmas: number[] }>();
    for (const mov of [movEnt, movSai]) {
      for (const [k, a] of mov.agregado) {
        if (!a.irmas.length) continue;
        const conta = Number(k.split(":")[1]);
        if (!contasSet.has(conta)) continue;
        const atual = agregado.get(k);
        if (atual) atual.valor += a.valor;
        else agregado.set(k, { valor: a.valor, irmas: [...a.irmas] });
      }
    }
    const apuracaoReal = agregado.size
      ? (
          await client.query<{ conta: number; nat: number; historico: number | null; contraconta: number | null; valor: number }>(
            `select contactbdeb conta, 1 nat, codigohistctb historico, contactbcred contraconta,
                    sum(valorlctoctb)::float valor
               from lctoctb where codigoempresa=$1 and codigooriglctoctb='FI'
                 and datalctoctb between $2 and $3 and contactbdeb = any($4::bigint[])
                 and chaveorigem !~ '^M[ES][0-9]+$'
              group by 1,3,4
             union all
             select contactbcred, -1, codigohistctb, contactbdeb, sum(valorlctoctb)::float
               from lctoctb where codigoempresa=$1 and codigooriglctoctb='FI'
                 and datalctoctb between $2 and $3 and contactbcred = any($4::bigint[])
                 and chaveorigem !~ '^M[ES][0-9]+$'
              group by 1,3,4`,
            [empresa, f.inicio, f.fim, contas]
          )
        ).rows
      : [];

    const culpados: BalanceteCulpado[] = [];
    for (const [k, a] of agregado) {
      const [natTxt, contaTxt, histTxt] = k.split(":");
      const nat = Number(natTxt);
      const conta = Number(contaTxt);
      const casadas = apuracaoReal.filter(
        (r) =>
          r.conta === conta &&
          r.nat === nat &&
          r.contraconta != null &&
          a.irmas.includes(r.contraconta) &&
          String(r.historico ?? 0) === histTxt
      );
      if (!casadas.length) continue; // sem apuração pra comparar: não vira diferença
      const real = casadas.reduce((t, r) => t + (nat === 1 ? r.valor : -r.valor), 0);
      const esperado = nat === 1 ? a.valor : -a.valor;
      const diferenca = esperado - real;
      if (Math.abs(diferenca) <= TOL) continue;
      culpados.push({
        chave: null,
        origem: "IM",
        numero: null,
        especie: null,
        conta,
        contaEsperada: a.irmas[0] ?? null,
        contraparte: "Apuração do período",
        esperado,
        real,
        diferenca,
        tipo: "apuracao",
      });
    }

    for (const a of mapa.values()) {
      if (semRegraConta.has(`${a.origem}:${a.chave}`)) continue; // espelhada: sem diferença
      const diferenca = a.esperado - a.real;
      let tipo: BalanceteCulpado["tipo"];
      if (Math.abs(diferenca) <= TOL) {
        // Diferença zero MAS em contas diferentes = remanejo INTERNO (só numa
        // sintética): a nota está no grupo, na gaveta errada — não altera o total
        // do grupo, mas as duas analíticas ficam erradas. Mostra à parte.
        // Remanejo interno de verdade: o motor esperava a nota em contas do
        // grupo e o real dela caiu em OUTRA — não numa das esperadas. Uma nota
        // que toca duas contas do alvo (o CTE gera frete E ICMS a recuperar)
        // tem a de maior valor diferente da primeira esperada, e isso não é
        // remanejo nenhum: é a nota fazendo o que a regra manda.
        const interno =
          Math.abs(a.esperado) > TOL &&
          a.contaEsp != null &&
          a.contaReal != null &&
          !a.contasEsp.has(a.contaReal) &&
          !incompletas.has(`${a.origem}:${a.chave}`);
        if (!interno) continue;
        tipo = "interno";
        // Mantém o resíduo sub-tolerância REAL: ele pertence à célula (é o
        // arredondamento dos pares) e zerá-lo quebra a reconciliação exata em
        // sintética com centenas de internos. A UI é que mostra "—" na coluna.
      } else {
        const temEsp = Math.abs(a.esperado) > TOL;
        const temReal = Math.abs(a.real) > TOL; // líquido nas contas do espelho
        const lancadaNoAlvo = a.contaRealAbs > TOL; // tem lançamento em alguma conta do alvo
        // Esperada aqui e sem líquido nas regradas: se mesmo assim foi lançada numa
        // conta do alvo (sem regra), é conta errada (foi pra 4483, não sumiu); senão
        // foi para fora do alvo = não lançada aqui. esp=0: conta errada se o motor a
        // reproduz em alguma conta; senão sem plano reproduzível.
        tipo = temEsp
          ? temReal
            ? "valor"
            : lancadaNoAlvo
              ? "conta_errada"
              : "faltando"
          : produzidas.has(`${a.origem}:${a.chave}`)
            ? "conta_errada"
            : "extra";
      }
      culpados.push({
        chave: a.chave,
        origem: a.origem,
        numero: a.numero,
        especie: a.especie,
        conta: a.contaReal ?? a.contaEsp,
        // A esperada no alvo quando o motor a esperou aqui; senão a conta que o
        // plano manda (pode ser fora do alvo) — é o "deveria estar em X".
        contaEsperada: a.contaEsp ?? producao.get(`${a.origem}:${a.chave}`)?.conta ?? null,
        contraparte: a.contraparte,
        esperado: a.esperado,
        real: a.real,
        diferenca,
        tipo,
        incompleta: incompletas.has(`${a.origem}:${a.chave}`),
      });
    }
    // Primeiro as diferenças de verdade (valor/faltando/conta errada), depois os
    // remanejos internos (erro real, mas neutro pro total) e por fim as "sem
    // regra" (NFSE/serviço que o motor não reproduz — provável não-erro).
    const prio = (t: string) => (t === "extra" ? 3 : t === "interno" ? 2 : t === "valor" ? 0 : 1);
    culpados.sort(
      (x, y) =>
        prio(x.tipo) - prio(y.tipo) ||
        Math.abs(y.diferenca) - Math.abs(x.diferenca) ||
        // Internos têm diferença ~0 — ordena pelo tamanho do remanejo.
        Math.abs(y.esperado) - Math.abs(x.esperado)
    );

    return {
      culpados: culpados.slice(0, 500),
      total: culpados.length,
    } satisfies BalanceteCulpadosResp;
  } finally {
    client.release();
  }
});
