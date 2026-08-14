import "server-only";
import { query } from "./db";
import { getSessaoOpcional, empresasPermitidas } from "./sessao";
import { montarResumoDp } from "./dp-produtividade";
import { montarRescisoes } from "./rescisoes";
import { periodosEmAberto } from "./controle-ferias";
import type {
  PainelAtividade,
  PainelColaborador,
  PainelEsocial,
  PainelFerias,
  PainelFeriasCritica,
  PainelGestao,
  PainelRescisaoUrgente,
  PainelRescisoes,
  PainelSeriePonto,
} from "./painel-dp-tipos";

/**
 * PAINÉIS DO DP — a home do módulo Folha/DP, em DUAS versões por cargo:
 *
 *  - `montarPainelColaborador`: a fila de trabalho — só pendências (rescisões a
 *    pagar, férias vencidas, eSocial a resolver) e as mais urgentes em lista.
 *  - `montarPainelGestao`: a visão do gestor — pendências + a atividade do DP no
 *    mês (produtividade, ranking de quem fez, série).
 *
 * Endpoints e permissões separados: o colaborador NÃO tem como buscar os dados
 * de gestão (ranking/produtividade). Cada bloco é uma consulta independente
 * colhida por `allSettled` — um erro num bloco vira `null` e o painel ainda
 * mostra os outros. Escopo de empresa pela sessão. Ver [[Módulo de folha e
 * eSocial do Questor]].
 */

// ── Datas (locais) ───────────────────────────────────────────────────────────

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDias(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}
function primeiroDiaMes(iso: string, nMeses = 0): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + nMeses, 1)).toISOString().slice(0, 10);
}

/** Escopo de empresa da sessão: "todas" ou a lista permitida (vazia = nada). */
async function escopoSessao(): Promise<number[] | "todas"> {
  const s = await getSessaoOpcional();
  return s ? empresasPermitidas(s) : [];
}

/** Quantos itens as listas de prioridade mostram. */
const TOP_URGENTES = 8;

// ── Rescisões (contagem + mais urgentes) ─────────────────────────────────────

async function blocoRescisoes(): Promise<{ counts: PainelRescisoes; urgentes: PainelRescisaoUrgente[] }> {
  const fim = hojeISO();
  const r = await montarRescisoes({ inicio: addDias(fim, -180), fim, empresas: [] }, fim);
  const urgentes = r.itens
    .filter((i) => i.situacao !== "resolvida")
    .slice(0, TOP_URGENTES)
    .map<PainelRescisaoUrgente>((i) => ({
      codigoempresa: i.codigoempresa,
      empresa: i.empresa,
      contrato: i.contrato,
      funcionario: i.funcionario,
      prazo: i.prazo,
      diasParaPrazo: i.diasParaPrazo,
      situacao: i.situacao,
    }));
  return { counts: { pendentes: r.pendentes, vencidas: r.vencidas, venceBreve: r.venceBreve }, urgentes };
}

// ── Férias (contagem + mais críticas) ────────────────────────────────────────

async function blocoFerias(
  scope: number[] | "todas"
): Promise<{ counts: PainelFerias; criticas: PainelFeriasCritica[] }> {
  const ref = hojeISO();
  const empF = scope === "todas" ? "" : ` and f.codigoempresa = any($2::int[])`;
  const paramsF = scope === "todas" ? [ref] : [ref, scope];
  const empR = scope === "todas" ? "" : ` where codigoempresa = any($1::int[])`;
  const paramsR = scope === "todas" ? [] : [scope];

  const [ativos, recibos] = await Promise.all([
    query<{ chave: string; codigoempresa: number; empresa: string; contrato: number; funcionario: string; admissao: string }>(
      `select (f.codigoempresa || ':' || f.codigofunccontr) as chave,
              f.codigoempresa,
              coalesce(nullif(btrim(e.nomeempresa), ''), 'Empresa ' || f.codigoempresa) as empresa,
              f.codigofunccontr as contrato,
              coalesce(nullif(btrim(f.nomefunc), ''), 'Contrato ' || f.codigofunccontr) as funcionario,
              to_char(f.dataadm, 'YYYY-MM-DD') as admissao
         from funcionario f
         left join empresa e on e.codigoempresa = f.codigoempresa
        where f.dataadm is not null and (f.datadem is null or f.datadem > $1)
          and f.categoria = '01'${empF}`,
      paramsF
    ),
    query<{ chave: string; aquis: string | null }>(
      `select (codigoempresa || ':' || codigofunccontr) as chave,
              to_char(datainicial, 'YYYY-MM-DD') as aquis
         from reciboferias${empR}`,
      paramsR
    ),
  ]);

  const gozados = new Map<string, string[]>();
  for (const r of recibos) {
    if (!r.aquis) continue;
    const arr = gozados.get(r.chave);
    if (arr) arr.push(r.aquis);
    else gozados.set(r.chave, [r.aquis]);
  }

  let vencidas = 0;
  let aVencer = 0;
  const criticas: PainelFeriasCritica[] = [];
  for (const a of ativos) {
    const abertos = periodosEmAberto(a.admissao, ref, gozados.get(a.chave) ?? []);
    const nVencidos = abertos.filter((p) => p.vencido).length;
    if (nVencidos > 0) {
      vencidas++;
      const critico = abertos.reduce((pior, p) => (p.diasParaLimite < pior.diasParaLimite ? p : pior));
      criticas.push({
        codigoempresa: a.codigoempresa,
        empresa: a.empresa,
        contrato: a.contrato,
        funcionario: a.funcionario,
        periodosVencidos: nVencidos,
        diasParaLimite: critico.diasParaLimite,
      });
    } else if (abertos.some((p) => p.diasParaLimite <= 120)) {
      aVencer++;
    }
  }
  criticas.sort((x, y) => y.periodosVencidos - x.periodosVencidos || x.diasParaLimite - y.diasParaLimite);
  return { counts: { vencidas, aVencer }, criticas: criticas.slice(0, TOP_URGENTES) };
}

// ── eSocial (só contagem) ────────────────────────────────────────────────────

async function blocoEsocial(scope: number[] | "todas"): Promise<PainelEsocial> {
  const desde = addDias(hojeISO(), -90);
  const emp = scope === "todas" ? "" : ` and codigoempresa = any($2::int[])`;
  const params = scope === "todas" ? [desde] : [desde, scope];
  const [row] = await query<{ pendentes: number; rejeitados: number }>(
    `select count(*) filter (where (recibo is null or btrim(recibo) = '') and status <> 13)::int as pendentes,
            count(*) filter (where (recibo is null or btrim(recibo) = '') and status = 13)::int as rejeitados
       from esocialtransacao
      where datahoralcto::date >= $1${emp}`,
    params
  );
  return { pendentes: row?.pendentes ?? 0, rejeitados: row?.rejeitados ?? 0 };
}

// ── Atividade e série (só gestão) ────────────────────────────────────────────

async function blocoAtividade(inicio: string, fim: string): Promise<PainelAtividade> {
  const resumo = await montarResumoDp({ inicio, fim, empresas: [], usuario: null });
  const topOperadores = resumo.ranking
    .filter((c) => !c.auto && c.total > 0)
    .slice(0, 5)
    .map((c) => ({ nome: c.nome, total: c.total }));
  return { mes: resumo.totais, anterior: resumo.anterior, colaboradores: resumo.colaboradores, topOperadores };
}

async function blocoSerie(scope: number[] | "todas"): Promise<PainelSeriePonto[]> {
  const inicio = primeiroDiaMes(hojeISO(), -5);
  const emp = scope === "todas" ? "" : ` and codigoempresa = any($2::int[])`;
  const params = scope === "todas" ? [inicio] : [inicio, scope];
  return query<PainelSeriePonto>(
    `with fonte as (
       select date_trunc('month', datahoralcto)::date b, 'a'::text t from funcavisoprevio where datahoralcto::date >= $1${emp}
       union all
       select date_trunc('month', datahoralcto)::date, 'r' from rescisao where datahoralcto::date >= $1${emp}
       union all
       select date_trunc('month', datahoralcto)::date, 'd' from funccontrato where datahoralcto::date >= $1${emp}
       union all
       select date_trunc('month', datahoralcto)::date, 'f' from reciboferias where datahoralcto::date >= $1${emp}
     )
     select to_char(g.b, 'YYYY-MM') as bucket,
            count(fonte.t) filter (where fonte.t = 'a')::int as avisos,
            count(fonte.t) filter (where fonte.t = 'r')::int as rescisoes,
            count(fonte.t) filter (where fonte.t = 'd')::int as admissoes,
            count(fonte.t) filter (where fonte.t = 'f')::int as ferias
       from generate_series(date_trunc('month', $1::date), date_trunc('month', current_date), interval '1 month') g(b)
       left join fonte on fonte.b = g.b::date
      group by g.b
      order by g.b`,
    params
  );
}

// ── Assembladores ────────────────────────────────────────────────────────────

function colher<T>(r: PromiseSettledResult<T>, nome: string): T | null {
  if (r.status === "fulfilled") return r.value;
  console.error(`[painel-dp] bloco '${nome}' falhou:`, r.reason);
  return null;
}

export async function montarPainelColaborador(): Promise<PainelColaborador> {
  const fim = hojeISO();
  const inicio = primeiroDiaMes(fim);
  const scope = await escopoSessao();

  const [rescisoes, ferias, esocial] = await Promise.allSettled([
    blocoRescisoes(),
    blocoFerias(scope),
    blocoEsocial(scope),
  ]);
  const r = colher(rescisoes, "rescisoes");
  const f = colher(ferias, "ferias");

  return {
    periodo: { inicio, fim },
    rescisoes: r?.counts ?? null,
    ferias: f?.counts ?? null,
    esocial: colher(esocial, "esocial"),
    rescisoesUrgentes: r?.urgentes ?? null,
    feriasCriticas: f?.criticas ?? null,
  };
}

export async function montarPainelGestao(): Promise<PainelGestao> {
  const fim = hojeISO();
  const inicio = primeiroDiaMes(fim);
  const scope = await escopoSessao();

  const [rescisoes, ferias, esocial, atividade, serie] = await Promise.allSettled([
    blocoRescisoes(),
    blocoFerias(scope),
    blocoEsocial(scope),
    blocoAtividade(inicio, fim),
    blocoSerie(scope),
  ]);
  const r = colher(rescisoes, "rescisoes");
  const f = colher(ferias, "ferias");

  return {
    periodo: { inicio, fim },
    rescisoes: r?.counts ?? null,
    ferias: f?.counts ?? null,
    esocial: colher(esocial, "esocial"),
    atividade: colher(atividade, "atividade"),
    serie: colher(serie, "serie"),
  };
}
