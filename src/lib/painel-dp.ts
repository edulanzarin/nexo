import "server-only";
import { query } from "./db";
import { getSessaoOpcional, empresasPermitidas } from "./sessao";
import { montarResumoDp } from "./dp-produtividade";
import { montarRescisoes } from "./rescisoes";
import { periodosEmAberto } from "./controle-ferias";
import type {
  PainelAtividade,
  PainelDp,
  PainelEsocial,
  PainelFerias,
  PainelRescisoes,
  PainelSeriePonto,
} from "./painel-dp-tipos";

/**
 * PAINEL DO DP — a home do módulo Folha/DP: um retrato do escritório inteiro que
 * carrega sozinho (sem filtro nem Executar). Junta duas coisas: as PENDÊNCIAS
 * que cobram ação (rescisões a pagar, férias vencidas, eSocial a resolver) e a
 * ATIVIDADE do DP no mês (o que cada trabalho movimentou).
 *
 * Cada bloco é uma consulta INDEPENDENTE, colhida por `allSettled`: se uma falha
 * (ex.: a query office-wide de férias esbarrar num detalhe do schema não testado
 * no dev), o bloco vira `null` e o painel ainda mostra os outros — o painel não
 * cai por um card. Escopo de empresa pela sessão, como o resto da Folha.
 *
 * Reusa o que já é office-wide e validado: `montarResumoDp` (produtividade) e
 * `montarRescisoes` (rescisões). Férias, eSocial e a série são agregados leves
 * próprios daqui. Ver [[Módulo de folha e eSocial do Questor]].
 */

// ── Datas (locais) ───────────────────────────────────────────────────────────

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDias(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}
/** Primeiro dia do mês de `iso`, opcionalmente `nMeses` atrás. */
function primeiroDiaMes(iso: string, nMeses = 0): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + nMeses, 1)).toISOString().slice(0, 10);
}

/** Escopo de empresa da sessão: "todas" ou a lista permitida (vazia = nada). */
async function escopoSessao(): Promise<number[] | "todas"> {
  const s = await getSessaoOpcional();
  return s ? empresasPermitidas(s) : [];
}

// ── Blocos office-wide próprios ──────────────────────────────────────────────

/** Férias vencidas (dobro) e a vencer (≤120 dias), no escopo. Mesma regra da
 *  tela de Férias (deriva de dataadm × recibos), agregada sem empresa fixa. */
async function blocoFerias(scope: number[] | "todas"): Promise<PainelFerias> {
  const ref = hojeISO();
  const empF = scope === "todas" ? "" : ` and f.codigoempresa = any($2::int[])`;
  const paramsF = scope === "todas" ? [ref] : [ref, scope];
  const empR = scope === "todas" ? "" : ` where codigoempresa = any($1::int[])`;
  const paramsR = scope === "todas" ? [] : [scope];

  const [ativos, recibos] = await Promise.all([
    query<{ chave: string; admissao: string }>(
      `select (f.codigoempresa || ':' || f.codigofunccontr) as chave,
              to_char(f.dataadm, 'YYYY-MM-DD') as admissao
         from funcionario f
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
  for (const a of ativos) {
    const abertos = periodosEmAberto(a.admissao, ref, gozados.get(a.chave) ?? []);
    if (abertos.some((p) => p.vencido)) {
      vencidas++;
    } else if (abertos.some((p) => p.diasParaLimite <= 120)) {
      aVencer++;
    }
  }
  return { vencidas, aVencer };
}

/** eSocial a resolver: transmissões dos últimos 90 dias sem recibo — pendentes
 *  (sem rejeição) e rejeitadas (status 13). Panorama por `esocialtransacao`,
 *  sem ligar ao contrato — ver [[Módulo de folha e eSocial do Questor]]. */
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

/** Série mensal dos quatro trabalhos do DP nos últimos 6 meses. */
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

/** Atividade do mês corrente via a Produtividade do DP (já office-wide/validada). */
async function blocoAtividade(inicio: string, fim: string): Promise<PainelAtividade> {
  const resumo = await montarResumoDp({ inicio, fim, empresas: [], usuario: null });
  const topOperadores = resumo.ranking
    .filter((c) => !c.auto && c.total > 0)
    .slice(0, 5)
    .map((c) => ({ nome: c.nome, total: c.total }));
  return {
    mes: resumo.totais,
    anterior: resumo.anterior,
    colaboradores: resumo.colaboradores,
    topOperadores,
  };
}

/** Rescisões a pagar em aberto (últimos 180 dias, como o cron). */
async function blocoRescisoes(): Promise<PainelRescisoes> {
  const fim = hojeISO();
  const r = await montarRescisoes({ inicio: addDias(fim, -180), fim, empresas: [] }, fim);
  return { pendentes: r.pendentes, vencidas: r.vencidas, venceBreve: r.venceBreve };
}

export async function montarPainelDp(): Promise<PainelDp> {
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

  const val = <T>(r: PromiseSettledResult<T>, nome: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    console.error(`[painel-dp] bloco '${nome}' falhou:`, r.reason);
    return null;
  };

  return {
    periodo: { inicio, fim },
    rescisoes: val(rescisoes, "rescisoes"),
    ferias: val(ferias, "ferias"),
    esocial: val(esocial, "esocial"),
    atividade: val(atividade, "atividade"),
    serie: val(serie, "serie"),
  };
}
