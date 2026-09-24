import "server-only";
import { query } from "./db";
import { periodoAnterior } from "./fiscal-filters";
import { carregarCadastrosFiscal } from "./fiscal-prod-comum";
import {
  bucketDe,
  buckets,
  condEscopo,
  granularidadeDe,
  percentilPonderado,
  somarMapa,
  type ProdFiltros,
} from "./prod-comum";
import { faixaDe, zeroFaixas } from "./prod-escala";
import {
  FAIXAS_APURACAO,
  chaveImposto,
  impostoNomeado,
  rotuloImposto,
  type ChaveApuracao,
  type FisApuCompetencia,
  type FisApuEmpresa,
  type FisApuImposto,
  type FisApuPessoa,
  type FisApuPonto,
  type FiscalApuracaoResp,
} from "./fiscal-apuracao-tipos";

/**
 * ABA APURAÇÃO — o fechamento mensal do fiscal, por pessoa, imposto e
 * competência. O porquê da aba e o problema dos rótulos estão em
 * `fiscal-apuracao-tipos`.
 *
 * Uma varredura só, no grão (usuário, empresa, estab, imposto, competência, dia
 * e hora do trabalho), com as duas tabelas de apuração unidas — a do movimento e
 * a das retenções. São 64 mil e 15 mil linhas: a varredura inteira é mais barata
 * que qualquer outra aba da seção, e por isso esta é a única que responde no ano
 * sem risco de estourar o `statement_timeout`.
 *
 * Não há índice em `datahorausuario` (só em `(codigoempresa, codigoestab,
 * tipoimposto, datainicial)`), então o filtro de período varre — o que, a 64 mil
 * linhas, é irrelevante.
 *
 * Toda medida central é MEDIANA/p90 ponderada pelo grão, nunca média: o tipo 71
 * tem cauda de 485 dias no p90 e a média o faria parecer o normal do escritório.
 */

interface GraoRow {
  u: number;
  e: number;
  est: number;
  tipo: number;
  retido: boolean;
  /** Fim da competência apurada, "YYYY-MM-DD". */
  cf: string;
  /** Competência em mês, "YYYY-MM". */
  cm: string;
  /** Dia do trabalho, "YYYY-MM-DD". */
  d: string;
  h: number;
  /** Dias entre o fim da competência e o dia da apuração (negativo = antecipada). */
  lag: number;
  n: number;
}

const TOP_EMPRESAS = 200;
const TOP_EMPRESAS_PESSOA = 25;

/** Um fechamento é (empresa, estab, competência) — o imposto é o leque dentro dele. */
const chaveFechamento = (r: GraoRow) => `${r.e}|${r.est}|${r.cm}`;

interface AccPessoa {
  fechamentos: Set<string>;
  apuracoes: number;
  lags: Map<number, number>;
  porFaixa: number[];
  impostos: Map<ChaveApuracao, number>;
  empresas: Map<number, number>;
  competencias: Set<string>;
  dias: Map<string, number>;
  horas: number[];
  maisVelha: string | null;
}

interface AccImposto {
  qtd: number;
  lags: Map<number, number>;
  porFaixa: number[];
  empresas: Set<number>;
  pessoas: Set<number>;
}

interface AccEmpresa {
  fechamentos: Set<string>;
  lags: Map<number, number>;
  impostos: Set<ChaveApuracao>;
  maisVelha: string | null;
}

const menorMes = (a: string | null, b: string) => (a === null || b < a ? b : a);

const novaPessoa = (): AccPessoa => ({
  fechamentos: new Set(),
  apuracoes: 0,
  lags: new Map(),
  porFaixa: zeroFaixas(FAIXAS_APURACAO),
  impostos: new Map(),
  empresas: new Map(),
  competencias: new Set(),
  dias: new Map(),
  horas: Array.from({ length: 24 }, () => 0),
  maisVelha: null,
});

/**
 * WHERE do período de TRABALHO. `datahorausuario` é timestamp: o fim entra como
 * `< fim + 1 dia`, senão o último dia seria cortado à meia-noite. O escopo de
 * empresa e o filtro de filial vêm do funil compartilhado.
 */
async function montarWhere(
  f: ProdFiltros,
  inicio: string,
  fim: string
): Promise<{ sql: string; params: unknown[] }> {
  const params: unknown[] = [inicio, fim];
  const conds = [`datahorausuario >= $1::date and datahorausuario < ($2::date + 1)`];
  conds.push(...(await condEscopo(f, params)));
  return { sql: conds.join(" and "), params };
}

export async function montarApuracaoFiscal(f: ProdFiltros): Promise<FiscalApuracaoResp> {
  const w = await montarWhere(f, f.inicio, f.fim);
  const prev = periodoAnterior(f);
  const wPrev = await montarWhere(f, prev.inicio, prev.fim);

  /**
   * As duas tabelas têm a MESMA forma (empresa, estab, tipoimposto, período,
   * usuário, carimbo) e são o mesmo trabalho para quem fecha — apurar o imposto
   * do movimento e apurar o que foi retido acontecem no mesmo dia, na mesma
   * empresa. Entram na mesma varredura, com uma coluna dizendo de qual vieram,
   * porque o `tipoimposto` das duas é um domínio DIFERENTE e não pode somar.
   */
  const selecao = (tabela: string, retido: string) => `
    select codigousuario, codigoempresa, codigoestab, tipoimposto,
           ${retido}::boolean as retido, datafinal, datahorausuario
      from ${tabela} where ${w.sql}`;

  const sqlGrao = `
    with apur as (
      ${selecao("periodoapuradofis", "false")}
      union all
      ${selecao("periodoapuradofisretido", "true")}
    )
    select codigousuario as u, codigoempresa as e, codigoestab as est,
           tipoimposto as tipo, retido,
           to_char(datafinal, 'YYYY-MM-DD') as cf,
           to_char(datafinal, 'YYYY-MM') as cm,
           to_char(datahorausuario, 'YYYY-MM-DD') as d,
           extract(hour from datahorausuario)::int as h,
           (datahorausuario::date - datafinal)::int as lag,
           count(*)::int as n
      from apur
     group by u, e, est, tipo, retido, cf, cm, d, h, lag`;

  const sqlAnterior = `
    select count(*)::int as apuracoes,
           count(distinct (codigoempresa, codigoestab, to_char(datafinal,'YYYY-MM')))::int as fechamentos
      from (
        select codigoempresa, codigoestab, datafinal from periodoapuradofis where ${wPrev.sql}
        union all
        select codigoempresa, codigoestab, datafinal from periodoapuradofisretido where ${wPrev.sql}
      ) t`;

  const [grao, [ant]] = await Promise.all([
    query<GraoRow>(sqlGrao, w.params),
    query<{ apuracoes: number; fechamentos: number }>(sqlAnterior, wPrev.params),
  ]);

  // ── Rollup ────────────────────────────────────────────────────────────────
  const pessoas = new Map<number, AccPessoa>();
  const impostos = new Map<ChaveApuracao, AccImposto>();
  const empresas = new Map<number, AccEmpresa>();
  const competencias = new Map<string, { fech: Set<string>; empresas: Set<number>; pessoas: Set<number>; lags: Map<number, number> }>();
  const fechamentos = new Set<string>();
  const dias = new Map<string, number>();
  const diasLag = new Map<string, Map<number, number>>();
  const horas = Array.from({ length: 24 }, () => 0);
  const lagsGeral = new Map<number, number>();
  const porFaixaGeral = zeroFaixas(FAIXAS_APURACAO);
  let apuracoes = 0;
  let maisVelhaGeral: string | null = null;

  for (const r of grao) {
    const chave = chaveImposto(r.tipo, r.retido);
    const fech = chaveFechamento(r);
    const faixa = faixaDe(FAIXAS_APURACAO, r.lag);

    apuracoes += r.n;
    fechamentos.add(fech);
    somarMapa(lagsGeral, r.lag, r.n);
    porFaixaGeral[faixa] += r.n;
    horas[r.h] += r.n;
    maisVelhaGeral = menorMes(maisVelhaGeral, r.cm);

    const imp = impostos.get(chave) ?? {
      qtd: 0,
      lags: new Map<number, number>(),
      porFaixa: zeroFaixas(FAIXAS_APURACAO),
      empresas: new Set<number>(),
      pessoas: new Set<number>(),
    };
    imp.qtd += r.n;
    somarMapa(imp.lags, r.lag, r.n);
    imp.porFaixa[faixa] += r.n;
    imp.empresas.add(r.e);
    imp.pessoas.add(r.u);
    impostos.set(chave, imp);

    const emp = empresas.get(r.e) ?? {
      fechamentos: new Set<string>(),
      lags: new Map<number, number>(),
      impostos: new Set<ChaveApuracao>(),
      maisVelha: null,
    };
    emp.fechamentos.add(fech);
    somarMapa(emp.lags, r.lag, r.n);
    emp.impostos.add(chave);
    emp.maisVelha = menorMes(emp.maisVelha, r.cm);
    empresas.set(r.e, emp);

    const comp = competencias.get(r.cm) ?? {
      fech: new Set<string>(),
      empresas: new Set<number>(),
      pessoas: new Set<number>(),
      lags: new Map<number, number>(),
    };
    comp.fech.add(fech);
    comp.empresas.add(r.e);
    comp.pessoas.add(r.u);
    somarMapa(comp.lags, r.lag, r.n);
    competencias.set(r.cm, comp);

    dias.set(r.d, (dias.get(r.d) ?? 0) + r.n);
    const dl = diasLag.get(r.d) ?? new Map<number, number>();
    somarMapa(dl, r.lag, r.n);
    diasLag.set(r.d, dl);

    const p = pessoas.get(r.u) ?? novaPessoa();
    p.fechamentos.add(fech);
    p.apuracoes += r.n;
    somarMapa(p.lags, r.lag, r.n);
    p.porFaixa[faixa] += r.n;
    somarMapa(p.impostos, chave, r.n);
    somarMapa(p.empresas, r.e, r.n);
    p.competencias.add(r.cm);
    somarMapa(p.dias, r.d, r.n);
    p.horas[r.h] += r.n;
    p.maisVelha = menorMes(p.maisVelha, r.cm);
    pessoas.set(r.u, p);
  }

  const cadastros = await carregarCadastrosFiscal([...empresas.keys()]);

  // ── Ranking de pessoas ───────────────────────────────────────────────────
  const ranking: FisApuPessoa[] = [...pessoas.entries()]
    .map(([codigo, p]) => {
      const serie = [...p.dias.entries()]
        .map(([d, n]) => ({ d, n }))
        .sort((a, b) => a.d.localeCompare(b.d));
      return {
        codigo,
        nome: cadastros.nomeUsuario(codigo),
        inativo: cadastros.usuarioInativo(codigo),
        fechamentos: p.fechamentos.size,
        apuracoes: p.apuracoes,
        impostos: p.impostos.size,
        empresas: p.empresas.size,
        competencias: p.competencias.size,
        diasAtivos: p.dias.size,
        mediana: percentilPonderado(p.lags, 0.5),
        p90: percentilPonderado(p.lags, 0.9),
        maisVelha: p.maisVelha,
        porFaixa: p.porFaixa,
        porImposto: [...p.impostos.entries()]
          .map(([chave, qtd]) => ({ chave, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        topEmpresas: [...p.empresas.entries()]
          .map(([c, qtd]) => ({ chave: String(c), nome: cadastros.nomeEmpresa(c), qtd, valor: 0 }))
          .sort((a, b) => b.qtd - a.qtd)
          .slice(0, TOP_EMPRESAS_PESSOA),
        porHora: p.horas,
        serie,
      } satisfies FisApuPessoa;
    })
    .sort((a, b) => b.fechamentos - a.fechamentos || b.apuracoes - a.apuracoes);

  // ── Impostos ─────────────────────────────────────────────────────────────
  const listaImpostos: FisApuImposto[] = [...impostos.entries()]
    .map(([chave, i]) => ({
      chave,
      nome: rotuloImposto(chave),
      qtd: i.qtd,
      empresas: i.empresas.size,
      pessoas: i.pessoas.size,
      mediana: percentilPonderado(i.lags, 0.5),
      p90: percentilPonderado(i.lags, 0.9),
      porFaixa: i.porFaixa,
      nomeado: impostoNomeado(chave),
    }))
    .sort((a, b) => b.qtd - a.qtd);

  const listaEmpresas: FisApuEmpresa[] = [...empresas.entries()]
    .map(([codigo, e]) => ({
      chave: String(codigo),
      nome: cadastros.nomeEmpresa(codigo),
      qtd: e.fechamentos.size,
      valor: 0,
      impostos: e.impostos.size,
      mediana: percentilPonderado(e.lags, 0.5),
      maisVelha: e.maisVelha,
    }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, TOP_EMPRESAS);

  // Competência em ordem CRONOLÓGICA, não por volume: a leitura é "até onde o
  // time voltou", e uma lista ordenada por quantidade esconde a cauda velha,
  // que é justamente o que interessa.
  const listaCompetencias: FisApuCompetencia[] = [...competencias.entries()]
    .map(([compet, c]) => ({
      compet,
      qtd: c.fech.size,
      empresas: c.empresas.size,
      pessoas: c.pessoas.size,
      mediana: percentilPonderado(c.lags, 0.5),
    }))
    .sort((a, b) => a.compet.localeCompare(b.compet));

  // ── Série do time ────────────────────────────────────────────────────────
  const granularidade = granularidadeDe(f.inicio, f.fim);
  const ordem = buckets(f.inicio, f.fim, granularidade);
  const porBucket = new Map<string, { total: number; lags: Map<number, number> }>();
  for (const b of ordem) porBucket.set(b, { total: 0, lags: new Map() });
  for (const [d, lags] of diasLag) {
    const ponto = porBucket.get(bucketDe(d, granularidade));
    if (!ponto) continue;
    for (const [lag, n] of lags) {
      somarMapa(ponto.lags, lag, n);
      ponto.total += n;
    }
  }
  const serie: FisApuPonto[] = ordem.map((b) => {
    const p = porBucket.get(b)!;
    return {
      bucket: b,
      total: p.total,
      mediana: percentilPonderado(p.lags, 0.5),
      p90: percentilPonderado(p.lags, 0.9),
    };
  });

  const celulas = [...dias.entries()]
    .map(([d, n]) => ({ d, n }))
    .sort((a, b) => a.d.localeCompare(b.d));
  let pico: { d: string; n: number } | null = null;
  for (const c of celulas) if (!pico || c.n > pico.n) pico = c;

  return {
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      fechamentos: fechamentos.size,
      apuracoes,
      pessoas: ranking.filter((p) => p.codigo !== 0).length,
      empresas: empresas.size,
      competencias: competencias.size,
      diasAtivos: dias.size,
      mediana: percentilPonderado(lagsGeral, 0.5),
      p90: percentilPonderado(lagsGeral, 0.9),
      noCiclo: porFaixaGeral[0],
      maisVelha: maisVelhaGeral,
      porFaixa: porFaixaGeral,
    },
    anterior: { fechamentos: ant?.fechamentos ?? 0, apuracoes: ant?.apuracoes ?? 0 },
    ranking,
    impostos: listaImpostos,
    empresas: listaEmpresas,
    competencias: listaCompetencias,
    serie,
    porHora: horas,
    calendario: { inicio: f.inicio, fim: f.fim, celulas, total: apuracoes, pico },
    semNome: listaImpostos.filter((i) => !i.nomeado).length,
  };
}
