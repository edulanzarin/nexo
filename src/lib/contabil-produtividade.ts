import "server-only";
import { query } from "./db";
import { FilterError, parseFilters, periodoAnterior, type FiscalFilters } from "./fiscal-filters";
import { empresasPermitidas, getSessaoOpcional } from "./sessao";
import {
  classeDaOrigem,
  zeroClasses,
  type ContabilProdutividadeResp,
  type CtbDia,
  type CtbItem,
  type CtbOrigemItem,
  type CtbPessoa,
  type CtbSeriePonto,
  type PorClasse,
} from "./contabil-produtividade-tipos";

/**
 * PRODUTIVIDADE DO CONTÁBIL — o que o time lançou no `lctoctb` no período.
 *
 * Três decisões que mandam no resto:
 *
 * 1. O recorte é `datahoralctoctb` (quando foi LANÇADO), não `datalctoctb` (a
 *    data do fato). Lançamento de maio feito em agosto é trabalho de agosto.
 *    Há índice próprio (`ixlctoctbdatahora`), então filtrar por ele é barato.
 * 2. UMA consulta só, num grão fino — (usuário, empresa, origem, dia, hora) —,
 *    e todo o resto (ranking, origens, empresas, série, calendário, horas) é
 *    rollup em Node. O grão é minúsculo perto da tabela (um mês do escritório
 *    inteiro ≈ 6 mil linhas para 2 milhões de lançamentos), então uma varredura
 *    responde a tela toda. Ver [[Agregar antes de juntar em tabelas gigantes no
 *    Postgres]].
 * 3. Nada de `count(distinct)` no SQL: empresas atendidas, dias e rodadas saem
 *    do grão, de graça. Com os distincts a mesma consulta custava ~5s no mês;
 *    sem eles, ~1,5s.
 *
 * Custo medido (escritório inteiro, sem filtro de empresa, ago/2026): mês ~4,5s,
 * trimestre ~10s, ano ~39s — dentro do `statement_timeout` de 60s, e a tela roda
 * no botão "Executar". Filtrar empresa derruba isso para frações de segundo.
 *
 * Empresa é OPCIONAL (como na Produtividade do DP): sem empresa, é o retrato do
 * escritório. O escopo da sessão continua mandando — a lista do cliente só
 * afunila.
 */

export type ProdFiltros = FiscalFilters;

export function parseProdFiltros(sp: URLSearchParams): ProdFiltros {
  return parseFilters(sp);
}

/** Escopo efetivo: "todas" (sem restrição) ou a interseção sessão × pedido. */
async function escopoEmpresas(f: ProdFiltros): Promise<number[] | "todas"> {
  const sessao = await getSessaoOpcional();
  const escopo: number[] | "todas" = sessao ? empresasPermitidas(sessao) : [];
  if (escopo === "todas") return f.empresas.length ? f.empresas : "todas";
  return f.empresas.length ? f.empresas.filter((e) => escopo.includes(e)) : escopo;
}

/**
 * WHERE do período de TRABALHO. `datahoralctoctb` é timestamp: o fim entra como
 * `< fim + 1 dia` para pegar o dia inteiro (entre datas cortaria à meia-noite).
 */
async function montarWhere(f: ProdFiltros): Promise<{ sql: string; params: unknown[] }> {
  const params: unknown[] = [f.inicio, f.fim];
  const conds = [`datahoralctoctb >= $1::date and datahoralctoctb < ($2::date + 1)`];

  const escopo = await escopoEmpresas(f);
  if (escopo !== "todas") {
    params.push(escopo);
    conds.push(`codigoempresa = any($${params.length}::int[])`);
  }
  if (f.estabs.length > 0) {
    params.push(f.estabs);
    conds.push(`codigoestab = any($${params.length}::int[])`);
  }
  return { sql: conds.join(" and "), params };
}

interface GraoRow {
  u: number;
  e: number;
  o: string;
  d: string;
  h: number;
  n: number;
  v: number;
}

/**
 * Tetos de empresas. O gráfico mostra uma dúzia, mas a EXPORTAÇÃO sai daqui —
 * por isso o teto é generoso: 200 empresas são ~12 KB no payload e cobrem o
 * escritório inteiro, em vez de entregar uma planilha truncada em 20.
 */
const TOP_EMPRESAS = 200;
/** Por pessoa o teto é menor: multiplica pelo tamanho do time no payload. */
const TOP_EMPRESAS_PESSOA = 25;

/** Acumulador interno de uma pessoa enquanto o grão é percorrido. */
interface Acc {
  codigo: number;
  lancamentos: number;
  valor: number;
  porClasse: PorClasse;
  origens: Map<string, number>;
  empresas: Map<number, { qtd: number; valor: number }>;
  dias: Map<string, number>;
  horas: number[];
  rodadas: Set<string>;
}

const novoAcc = (codigo: number): Acc => ({
  codigo,
  lancamentos: 0,
  valor: 0,
  porClasse: zeroClasses(),
  origens: new Map(),
  empresas: new Map(),
  dias: new Map(),
  horas: Array.from({ length: 24 }, () => 0),
  rodadas: new Set(),
});

const somaMapa = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);

/** Buckets densos do período (dia ou mês) — sem furo, para a série não mentir. */
function buckets(inicio: string, fim: string, granularidade: "dia" | "mes"): string[] {
  const out: string[] = [];
  const ini = new Date(inicio + "T00:00:00Z");
  const end = new Date(fim + "T00:00:00Z");
  if (granularidade === "mes") {
    const cur = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), 1));
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return out;
  }
  for (const t = new Date(ini); t <= end; t.setUTCDate(t.getUTCDate() + 1)) {
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

/** Dia "YYYY-MM-DD" → chave do bucket (o próprio dia, ou o 1º do mês). */
const bucketDe = (d: string, granularidade: "dia" | "mes") =>
  granularidade === "mes" ? d.slice(0, 7) + "-01" : d;

export async function montarProdutividadeContabil(
  f: ProdFiltros
): Promise<ContabilProdutividadeResp> {
  const w = await montarWhere(f);
  const prev = periodoAnterior(f);
  const paramsPrev = [prev.inicio, prev.fim, ...w.params.slice(2)];

  // Grão + período anterior em paralelo: o delta não espera a varredura grande.
  const [grao, [ant]] = await Promise.all([
    query<GraoRow>(
      `select codigousuario as u,
              codigoempresa as e,
              coalesce(nullif(btrim(codigooriglctoctb), ''), '--') as o,
              to_char(datahoralctoctb, 'YYYY-MM-DD') as d,
              extract(hour from datahoralctoctb)::int as h,
              count(*)::int as n,
              coalesce(sum(valorlctoctb), 0)::float as v
         from lctoctb
        where ${w.sql}
        group by 1, 2, 3, 4, 5`,
      w.params
    ),
    query<{ n: number; v: number }>(
      `select count(*)::int as n, coalesce(sum(valorlctoctb), 0)::float as v
         from lctoctb
        where ${w.sql}`,
      paramsPrev
    ),
  ]);

  // ── Rollup ────────────────────────────────────────────────────────────────
  const pessoas = new Map<number, Acc>();
  const origens = new Map<string, { qtd: number; valor: number; pessoas: Set<number> }>();
  const empresas = new Map<number, { qtd: number; valor: number }>();
  const dias = new Map<string, number>();
  const diasClasse = new Map<string, PorClasse>();
  const horas = Array.from({ length: 24 }, () => 0);
  const rodadas = new Set<string>();
  let lancamentos = 0;
  let valor = 0;

  for (const r of grao) {
    const classe = classeDaOrigem(r.o);
    lancamentos += r.n;
    valor += r.v;
    horas[r.h] += r.n;
    rodadas.add(`${r.u}|${r.e}|${r.o}|${r.d}`);

    const org = origens.get(r.o) ?? { qtd: 0, valor: 0, pessoas: new Set<number>() };
    org.qtd += r.n;
    org.valor += r.v;
    org.pessoas.add(r.u);
    origens.set(r.o, org);

    const emp = empresas.get(r.e) ?? { qtd: 0, valor: 0 };
    emp.qtd += r.n;
    emp.valor += r.v;
    empresas.set(r.e, emp);

    dias.set(r.d, (dias.get(r.d) ?? 0) + r.n);
    const dc = diasClasse.get(r.d) ?? zeroClasses();
    dc[classe] += r.n;
    diasClasse.set(r.d, dc);

    const p = pessoas.get(r.u) ?? novoAcc(r.u);
    p.lancamentos += r.n;
    p.valor += r.v;
    p.porClasse[classe] += r.n;
    p.horas[r.h] += r.n;
    p.rodadas.add(`${r.e}|${r.o}|${r.d}`);
    somaMapa(p.origens, r.o, r.n);
    somaMapa(p.dias, r.d, r.n);
    const pe = p.empresas.get(r.e) ?? { qtd: 0, valor: 0 };
    pe.qtd += r.n;
    pe.valor += r.v;
    p.empresas.set(r.e, pe);
    pessoas.set(r.u, p);
  }

  // ── Cadastros de apoio (só o necessário para nomear o que apareceu) ───────
  const codigosEmpresa = [...empresas.keys()];
  const [usuarios, nomesEmpresa, descrOrigem] = await Promise.all([
    query<{ codigo: number; nome: string | null; inativo: boolean }>(
      `select codigousuario as codigo,
              coalesce(nullif(btrim(nomeusuariocompl), ''), nullif(btrim(nomeusuario), '')) as nome,
              (databaixausuario is not null) as inativo
         from usuario`
    ),
    codigosEmpresa.length
      ? query<{ codigo: number; nome: string | null }>(
          `select codigoempresa as codigo, btrim(nomeempresa) as nome
             from empresa where codigoempresa = any($1::int[])`,
          [codigosEmpresa]
        )
      : Promise.resolve([]),
    query<{ codigo: string; descr: string | null }>(
      `select codigooriglctoctb as codigo, btrim(descroriglctoctb) as descr from origemlctoctb`
    ),
  ]);

  const mapaUsuario = new Map(usuarios.map((u) => [u.codigo, u]));
  const mapaEmpresa = new Map(nomesEmpresa.map((e) => [e.codigo, e.nome]));
  const mapaOrigem = new Map(descrOrigem.map((o) => [o.codigo, o.descr]));

  const nomeEmpresa = (c: number) => mapaEmpresa.get(c) || `Empresa ${c}`;
  const nomeOrigem = (c: string) => mapaOrigem.get(c) || (c === "--" ? "Sem origem" : `Origem ${c}`);
  const itensEmpresa = (m: Map<number, { qtd: number; valor: number }>, teto: number): CtbItem[] =>
    [...m.entries()]
      .map(([codigo, v]) => ({ chave: String(codigo), nome: nomeEmpresa(codigo), ...v }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, teto);

  // ── Ranking de pessoas ───────────────────────────────────────────────────
  const ranking: CtbPessoa[] = [...pessoas.values()]
    .map((p) => {
      const u = mapaUsuario.get(p.codigo);
      const serie: CtbDia[] = [...p.dias.entries()]
        .map(([d, n]) => ({ d, n }))
        .sort((a, b) => a.d.localeCompare(b.d));
      return {
        codigo: p.codigo,
        // Usuário 0 é o ADMINISTRADOR do Questor (rotinas automáticas). No
        // contábil ele praticamente não aparece, mas se aparecer tem de ficar
        // legível — não é ninguém do time.
        nome: p.codigo === 0 ? "Sistema (automático)" : (u?.nome ?? `Usuário ${p.codigo}`),
        inativo: u?.inativo ?? false,
        lancamentos: p.lancamentos,
        valor: p.valor,
        empresas: p.empresas.size,
        diasAtivos: p.dias.size,
        rodadas: p.rodadas.size,
        ultimo: serie.length ? serie[serie.length - 1].d : null,
        porClasse: p.porClasse,
        origens: [...p.origens.entries()]
          .map(([chave, qtd]) => ({ chave, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        topEmpresas: itensEmpresa(p.empresas, TOP_EMPRESAS_PESSOA),
        porHora: p.horas,
        serie,
      } satisfies CtbPessoa;
    })
    .sort((a, b) => b.lancamentos - a.lancamentos);

  // ── Série do time (buckets densos, quebrada por classe) ───────────────────
  const nDias = (Date.parse(f.fim) - Date.parse(f.inicio)) / 86_400_000 + 1;
  const granularidade: "dia" | "mes" = nDias > 92 ? "mes" : "dia";
  const porBucket = new Map<string, CtbSeriePonto>();
  for (const b of buckets(f.inicio, f.fim, granularidade)) {
    porBucket.set(b, { bucket: b, total: 0, ...zeroClasses() });
  }
  for (const [d, classes] of diasClasse) {
    const ponto = porBucket.get(bucketDe(d, granularidade));
    if (!ponto) continue; // lançamento fora do período pedido não existe aqui
    for (const [classe, n] of Object.entries(classes) as [keyof PorClasse, number][]) {
      ponto[classe] += n;
      ponto.total += n;
    }
  }

  // ── Calendário (grade diária do time) ─────────────────────────────────────
  const celulas: CtbDia[] = [...dias.entries()]
    .map(([d, n]) => ({ d, n }))
    .sort((a, b) => a.d.localeCompare(b.d));
  let pico: CtbDia | null = null;
  for (const c of celulas) if (!pico || c.n > pico.n) pico = c;

  const totaisClasse = zeroClasses();
  for (const p of ranking) {
    for (const [classe, n] of Object.entries(p.porClasse) as [keyof PorClasse, number][]) {
      totaisClasse[classe] += n;
    }
  }

  const listaOrigens: CtbOrigemItem[] = [...origens.entries()]
    .map(([chave, o]) => ({
      chave,
      nome: nomeOrigem(chave),
      classe: classeDaOrigem(chave),
      qtd: o.qtd,
      valor: o.valor,
      pessoas: o.pessoas.size,
    }))
    .sort((a, b) => b.qtd - a.qtd);

  return {
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      lancamentos,
      valor,
      pessoas: ranking.filter((p) => p.codigo !== 0).length,
      empresas: empresas.size,
      rodadas: rodadas.size,
      diasAtivos: dias.size,
      porClasse: totaisClasse,
    },
    anterior: { lancamentos: ant?.n ?? 0, valor: ant?.v ?? 0 },
    ranking,
    origens: listaOrigens,
    empresas: itensEmpresa(empresas, TOP_EMPRESAS),
    porHora: horas,
    serie: [...porBucket.values()],
    calendario: { inicio: f.inicio, fim: f.fim, celulas, total: lancamentos, pico },
  };
}

export { FilterError };
