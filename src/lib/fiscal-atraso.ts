import "server-only";
import { query } from "./db";
import { carregarCadastrosFiscal, whereTrabalho } from "./fiscal-prod-comum";
import {
  bucketDe,
  buckets,
  granularidadeDe,
  percentilPonderado,
  somarMapa,
  type ProdFiltros,
} from "./prod-comum";
import { faixaDe, zeroFaixas } from "./prod-escala";
import {
  FAIXAS_ATRASO_FISCAL,
  type FisAtrasoEmpresa,
  type FisAtrasoPessoa,
  type FisAtrasoPonto,
  type FisCompetencia,
  type FiscalAtrasoResp,
} from "./fiscal-atraso-tipos";

/**
 * ABA ATRASO — quanto tempo separa o documento da escrituração.
 *
 * Uma varredura no grão (usuário, empresa, data do documento, dia da
 * escrituração), entrada e saída juntas. O grão guarda a data do documento em
 * DIA, não em mês: só assim o atraso é exato e a mediana sai de uma distribuição
 * de verdade, em vez de um mês arredondado.
 *
 * Toda medida central é MEDIANA/p90 ponderada pelo grão (`percentilPonderado`),
 * nunca média — ver [[A régua sai da distribuição, não dos extremos]].
 */

interface GraoRow {
  u: number;
  e: number;
  /** Data do documento (competência), "YYYY-MM-DD". */
  c: string;
  /** Dia da escrituração, "YYYY-MM-DD". */
  d: string;
  /** Dias entre o documento e a escrituração (negativo em emissão adiantada). */
  lag: number;
  n: number;
}

/** Empresa com pouquíssima nota tem mediana de brinquedo: fica fora do ranking. */
const MINIMO_EMPRESA = 20;
const TOP_EMPRESAS = 200;

interface AccPessoa {
  notas: number;
  lags: Map<number, number>;
  porFaixa: number[];
  competencias: Set<string>;
  empresas: Set<number>;
  maisVelha: string | null;
}

interface AccEmpresa {
  notas: number;
  lags: Map<number, number>;
  porFaixa: number[];
  maisVelha: string | null;
}

const menorData = (a: string | null, b: string) => (a === null || b < a ? b : a);

export async function montarAtrasoFiscal(f: ProdFiltros): Promise<FiscalAtrasoResp> {
  const w = await whereTrabalho(f);
  const selecao = (tabela: string) =>
    `select codigousuario, codigoempresa, datalctofis, datahoralctofis from ${tabela} where ${w.sql}`;

  const grao = await query<GraoRow>(
    `with mov as (
       ${selecao("lctofisent")}
       union all
       ${selecao("lctofissai")}
     )
     select codigousuario as u,
            codigoempresa as e,
            to_char(datalctofis, 'YYYY-MM-DD') as c,
            to_char(datahoralctofis, 'YYYY-MM-DD') as d,
            (datahoralctofis::date - datalctofis) as lag,
            count(*)::int as n
       from mov
      group by 1, 2, 3, 4, 5`,
    w.params
  );

  const pessoas = new Map<number, AccPessoa>();
  const empresas = new Map<number, AccEmpresa>();
  const competencias = new Map<string, { qtd: number; lags: Map<number, number>; pessoas: Set<number> }>();
  const porBucketDia = new Map<string, { total: number; lags: Map<number, number> }>();
  const lags = new Map<number, number>();
  const porFaixa = zeroFaixas(FAIXAS_ATRASO_FISCAL);
  let notas = 0;
  let maisVelha: string | null = null;

  for (const r of grao) {
    const faixa = faixaDe(FAIXAS_ATRASO_FISCAL, r.lag);
    const compet = r.c.slice(0, 7);
    notas += r.n;
    porFaixa[faixa] += r.n;
    somarMapa(lags, r.lag, r.n);
    maisVelha = menorData(maisVelha, compet);

    const p = pessoas.get(r.u) ?? {
      notas: 0,
      lags: new Map(),
      porFaixa: zeroFaixas(FAIXAS_ATRASO_FISCAL),
      competencias: new Set<string>(),
      empresas: new Set<number>(),
      maisVelha: null,
    };
    p.notas += r.n;
    somarMapa(p.lags, r.lag, r.n);
    p.porFaixa[faixa] += r.n;
    p.competencias.add(compet);
    p.empresas.add(r.e);
    p.maisVelha = menorData(p.maisVelha, compet);
    pessoas.set(r.u, p);

    const em = empresas.get(r.e) ?? {
      notas: 0,
      lags: new Map(),
      porFaixa: zeroFaixas(FAIXAS_ATRASO_FISCAL),
      maisVelha: null,
    };
    em.notas += r.n;
    somarMapa(em.lags, r.lag, r.n);
    em.porFaixa[faixa] += r.n;
    em.maisVelha = menorData(em.maisVelha, compet);
    empresas.set(r.e, em);

    const co = competencias.get(compet) ?? { qtd: 0, lags: new Map(), pessoas: new Set<number>() };
    co.qtd += r.n;
    somarMapa(co.lags, r.lag, r.n);
    co.pessoas.add(r.u);
    competencias.set(compet, co);

    const b = porBucketDia.get(r.d) ?? { total: 0, lags: new Map() };
    b.total += r.n;
    somarMapa(b.lags, r.lag, r.n);
    porBucketDia.set(r.d, b);
  }

  const cadastros = await carregarCadastrosFiscal([...empresas.keys()]);

  const ranking: FisAtrasoPessoa[] = [...pessoas.entries()]
    .map(([codigo, p]) => ({
      codigo,
      nome: cadastros.nomeUsuario(codigo),
      inativo: cadastros.usuarioInativo(codigo),
      notas: p.notas,
      mediana: percentilPonderado(p.lags, 0.5),
      p90: percentilPonderado(p.lags, 0.9),
      competencias: p.competencias.size,
      maisVelha: p.maisVelha,
      empresas: p.empresas.size,
      porFaixa: p.porFaixa,
    }))
    .sort((a, b) => (b.mediana ?? 0) - (a.mediana ?? 0));

  const listaEmpresas: FisAtrasoEmpresa[] = [...empresas.entries()]
    .filter(([, e]) => e.notas >= MINIMO_EMPRESA)
    .map(([codigo, e]) => ({
      chave: String(codigo),
      nome: cadastros.nomeEmpresa(codigo),
      notas: e.notas,
      mediana: percentilPonderado(e.lags, 0.5),
      p90: percentilPonderado(e.lags, 0.9),
      maisVelha: e.maisVelha,
      porFaixa: e.porFaixa,
    }))
    .sort((a, b) => (b.mediana ?? 0) - (a.mediana ?? 0))
    .slice(0, TOP_EMPRESAS);

  // Competências em ordem cronológica: o eixo é o tempo do documento, e ordenar
  // por quantidade embaralharia a leitura de "até onde o time voltou".
  const listaCompetencias: FisCompetencia[] = [...competencias.entries()]
    .map(([compet, c]) => ({
      compet,
      qtd: c.qtd,
      mediana: percentilPonderado(c.lags, 0.5),
      pessoas: c.pessoas.size,
    }))
    .sort((a, b) => a.compet.localeCompare(b.compet));

  const granularidade = granularidadeDe(f.inicio, f.fim);
  const serieMapa = new Map<string, { total: number; lags: Map<number, number> }>();
  for (const b of buckets(f.inicio, f.fim, granularidade)) {
    serieMapa.set(b, { total: 0, lags: new Map() });
  }
  for (const [d, v] of porBucketDia) {
    const alvo = serieMapa.get(bucketDe(d, granularidade));
    if (!alvo) continue;
    alvo.total += v.total;
    for (const [lag, n] of v.lags) somarMapa(alvo.lags, lag, n);
  }
  const serie: FisAtrasoPonto[] = [...serieMapa.entries()].map(([bucket, v]) => ({
    bucket,
    total: v.total,
    mediana: percentilPonderado(v.lags, 0.5),
    p90: percentilPonderado(v.lags, 0.9),
  }));

  return {
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      notas,
      mediana: percentilPonderado(lags, 0.5),
      p90: percentilPonderado(lags, 0.9),
      noCiclo: porFaixa[0],
      competencias: competencias.size,
      maisVelha,
      porFaixa,
    },
    ranking,
    empresas: listaEmpresas,
    competencias: listaCompetencias,
    serie,
    minimoEmpresa: MINIMO_EMPRESA,
  };
}
