import "server-only";
import { query } from "./db";
import { periodoAnterior } from "./fiscal-filters";
import {
  bucketDe,
  buckets,
  carregarCadastros,
  condEscopo,
  granularidadeDe,
  percentilPonderado,
  somarMapa,
  type ProdFiltros,
} from "./contabil-prod-comum";
import { faixaDe, zeroFaixas } from "./contabil-prod-escala";
import {
  classeDaOrigem,
  zeroClasses,
  type CtbDia,
  type CtbItem,
  type PorClasse,
} from "./contabil-produtividade-tipos";
import {
  FAIXAS_IDADE,
  type ContabilExclusoesResp,
  type CtbExclAutor,
  type CtbExclPessoa,
} from "./contabil-exclusoes-tipos";

/**
 * ABA EXCLUSÕES — o que o time apagou do `lctoctb` no período.
 *
 * O Questor não deleta de verdade: move para `lctoctbexcluido`, mantendo a linha
 * original inteira e acrescentando `dataexclusao` + `usuarioexclusao`. Isso deixa
 * responder as duas perguntas de uma vez: quem apagou E de quem era.
 *
 * Uma varredura só, no grão (quem excluiu, quem lançou, empresa, origem, dia,
 * idade) — a mesma doutrina da aba Lançamentos. Um mês do escritório inteiro dá
 * poucos milhares de linhas de grão para ~400 mil exclusões, e responde a tela
 * toda sem `count(distinct)`.
 *
 * `dataexclusao` é DATE (não timestamp) e não tem índice próprio: o filtro varre
 * a tabela. Medido em ago/2026 sobre 10,7 milhões de linhas: ~1,3 s para o mês,
 * bem dentro do teto de 60 s.
 */

interface GraoRow {
  ux: number;
  ua: number;
  e: number;
  o: string;
  d: string;
  idade: number;
  n: number;
  v: number;
}

const TOP_EMPRESAS = 200;
const TOP_EMPRESAS_PESSOA = 25;
const TOP_AUTORES = 40;

interface Acc {
  codigo: number;
  excluidos: number;
  valor: number;
  proprios: number;
  porClasse: PorClasse;
  porFaixa: number[];
  idades: Map<number, number>;
  idadeMaxima: number;
  origens: Map<string, number>;
  autores: Map<number, number>;
  empresas: Map<number, { qtd: number; valor: number }>;
  dias: Map<string, number>;
}

const novoAcc = (codigo: number): Acc => ({
  codigo,
  excluidos: 0,
  valor: 0,
  proprios: 0,
  porClasse: zeroClasses(),
  porFaixa: zeroFaixas(FAIXAS_IDADE),
  idades: new Map(),
  idadeMaxima: 0,
  origens: new Map(),
  autores: new Map(),
  empresas: new Map(),
  dias: new Map(),
});

/** WHERE do período de EXCLUSÃO (`dataexclusao` é DATE: `between` já pega o dia inteiro). */
async function montarWhere(f: ProdFiltros): Promise<{ sql: string; params: unknown[] }> {
  const params: unknown[] = [f.inicio, f.fim];
  const conds = [`dataexclusao between $1::date and $2::date`];
  conds.push(...(await condEscopo(f, params)));
  return { sql: conds.join(" and "), params };
}

export async function montarExclusoesContabil(f: ProdFiltros): Promise<ContabilExclusoesResp> {
  const w = await montarWhere(f);
  const prev = periodoAnterior(f);
  const paramsPrev = [prev.inicio, prev.fim, ...w.params.slice(2)];

  // O denominador do retrabalho vem da MESMA janela na tabela viva: sem ele,
  // "400 mil exclusões" não diz se é um mês normal ou um desastre.
  const paramsLcto: unknown[] = [f.inicio, f.fim];
  const condsLcto = [`datahoralctoctb >= $1::date and datahoralctoctb < ($2::date + 1)`];
  condsLcto.push(...(await condEscopo(f, paramsLcto)));

  const [grao, [ant], [lanc]] = await Promise.all([
    query<GraoRow>(
      `select usuarioexclusao as ux,
              codigousuario as ua,
              codigoempresa as e,
              coalesce(nullif(btrim(codigooriglctoctb), ''), '--') as o,
              to_char(dataexclusao, 'YYYY-MM-DD') as d,
              greatest(dataexclusao - datahoralctoctb::date, 0) as idade,
              count(*)::int as n,
              coalesce(sum(valorlctoctb), 0)::float as v
         from lctoctbexcluido
        where ${w.sql}
        group by 1, 2, 3, 4, 5, 6`,
      w.params
    ),
    query<{ n: number }>(
      `select count(*)::int as n from lctoctbexcluido where ${w.sql}`,
      paramsPrev
    ),
    query<{ n: number }>(
      `select count(*)::int as n from lctoctb where ${condsLcto.join(" and ")}`,
      paramsLcto
    ),
  ]);

  // ── Rollup ────────────────────────────────────────────────────────────────
  const pessoas = new Map<number, Acc>();
  const autores = new Map<number, { qtd: number; valor: number; proprios: number }>();
  const origens = new Map<string, { qtd: number; valor: number }>();
  const empresas = new Map<number, { qtd: number; valor: number }>();
  const dias = new Map<string, number>();
  const idades = new Map<number, number>();
  const porClasse = zeroClasses();
  const porFaixa = zeroFaixas(FAIXAS_IDADE);
  let excluidos = 0;
  let valor = 0;
  let deOutros = 0;

  for (const r of grao) {
    const classe = classeDaOrigem(r.o);
    const faixa = faixaDe(FAIXAS_IDADE, r.idade);
    const proprio = r.ux === r.ua;

    excluidos += r.n;
    valor += r.v;
    porClasse[classe] += r.n;
    porFaixa[faixa] += r.n;
    somarMapa(idades, r.idade, r.n);
    if (!proprio) deOutros += r.n;

    const org = origens.get(r.o) ?? { qtd: 0, valor: 0 };
    org.qtd += r.n;
    org.valor += r.v;
    origens.set(r.o, org);

    const emp = empresas.get(r.e) ?? { qtd: 0, valor: 0 };
    emp.qtd += r.n;
    emp.valor += r.v;
    empresas.set(r.e, emp);

    const aut = autores.get(r.ua) ?? { qtd: 0, valor: 0, proprios: 0 };
    aut.qtd += r.n;
    aut.valor += r.v;
    if (proprio) aut.proprios += r.n;
    autores.set(r.ua, aut);

    somarMapa(dias, r.d, r.n);

    const p = pessoas.get(r.ux) ?? novoAcc(r.ux);
    p.excluidos += r.n;
    p.valor += r.v;
    if (proprio) p.proprios += r.n;
    p.porClasse[classe] += r.n;
    p.porFaixa[faixa] += r.n;
    somarMapa(p.idades, r.idade, r.n);
    somarMapa(p.origens, r.o, r.n);
    somarMapa(p.autores, r.ua, r.n);
    if (r.idade > p.idadeMaxima) p.idadeMaxima = r.idade;
    somarMapa(p.dias, r.d, r.n);
    const pe = p.empresas.get(r.e) ?? { qtd: 0, valor: 0 };
    pe.qtd += r.n;
    pe.valor += r.v;
    p.empresas.set(r.e, pe);
    pessoas.set(r.ux, p);
  }

  const cadastros = await carregarCadastros({ empresas: [...empresas.keys()], origens: true });

  const itensEmpresa = (m: Map<number, { qtd: number; valor: number }>, teto: number): CtbItem[] =>
    [...m.entries()]
      .map(([codigo, v]) => ({ chave: String(codigo), nome: cadastros.nomeEmpresa(codigo), ...v }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, teto);

  const ranking: CtbExclPessoa[] = [...pessoas.values()]
    .map((p) => {
      const serie: CtbDia[] = [...p.dias.entries()]
        .map(([d, n]) => ({ d, n }))
        .sort((a, b) => a.d.localeCompare(b.d));
      return {
        codigo: p.codigo,
        nome: cadastros.nomeUsuario(p.codigo),
        inativo: cadastros.usuarioInativo(p.codigo),
        excluidos: p.excluidos,
        valor: p.valor,
        empresas: p.empresas.size,
        dias: p.dias.size,
        proprios: p.proprios,
        idadeMediana: percentilPonderado(p.idades, 0.5),
        idadeMaxima: p.idadeMaxima,
        porClasse: p.porClasse,
        porFaixa: p.porFaixa,
        origens: [...p.origens.entries()]
          .map(([chave, qtd]) => ({ chave, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        autores: [...p.autores.entries()]
          .map(([codigo, qtd]) => ({ chave: String(codigo), qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        topEmpresas: itensEmpresa(p.empresas, TOP_EMPRESAS_PESSOA),
        serie,
      } satisfies CtbExclPessoa;
    })
    .sort((a, b) => b.excluidos - a.excluidos);

  const listaAutores: CtbExclAutor[] = [...autores.entries()]
    .map(([codigo, a]) => ({
      chave: String(codigo),
      nome: cadastros.nomeUsuario(codigo),
      qtd: a.qtd,
      valor: a.valor,
      proprios: a.proprios,
    }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, TOP_AUTORES);

  const granularidade = granularidadeDe(f.inicio, f.fim);
  const porBucket = new Map<string, number>();
  for (const b of buckets(f.inicio, f.fim, granularidade)) porBucket.set(b, 0);
  for (const [d, n] of dias) {
    const b = bucketDe(d, granularidade);
    if (porBucket.has(b)) porBucket.set(b, (porBucket.get(b) ?? 0) + n);
  }

  const celulas: CtbDia[] = [...dias.entries()]
    .map(([d, n]) => ({ d, n }))
    .sort((a, b) => a.d.localeCompare(b.d));
  let pico: CtbDia | null = null;
  for (const c of celulas) if (!pico || c.n > pico.n) pico = c;

  return {
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      excluidos,
      valor,
      pessoas: ranking.filter((p) => p.codigo !== 0).length,
      empresas: empresas.size,
      dias: dias.size,
      lancados: lanc?.n ?? 0,
      idadeMediana: percentilPonderado(idades, 0.5),
      deOutros,
      porClasse,
      porFaixa,
    },
    anterior: { excluidos: ant?.n ?? 0 },
    ranking,
    autores: listaAutores,
    origens: [...origens.entries()]
      .map(([chave, o]) => ({
        chave,
        nome: cadastros.nomeOrigem(chave),
        classe: classeDaOrigem(chave),
        qtd: o.qtd,
        valor: o.valor,
      }))
      .sort((a, b) => b.qtd - a.qtd),
    empresas: itensEmpresa(empresas, TOP_EMPRESAS),
    serie: [...porBucket.entries()].map(([bucket, total]) => ({ bucket, total })),
    calendario: { inicio: f.inicio, fim: f.fim, celulas, total: excluidos, pico },
  };
}
