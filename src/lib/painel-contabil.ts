import "server-only";
import { appQuery } from "./app-db";
import { getSessaoOpcional, empresasPermitidas } from "./sessao";
import type {
  ContabilAtividade,
  ContabilBase,
  ContabilEvento,
  ContabilSeriePonto,
  PainelContabilColaborador,
  PainelContabilGestao,
} from "./painel-contabil-tipos";

/**
 * PAINÉIS DO CONTÁBIL — a home do módulo, em DUAS versões por cargo:
 *
 *  - `montarPainelContabilColaborador`: os MEUS números do mês + a base
 *    configurada. Recorte por dono (`usuario_id` da trilha), como o Post Mortem
 *    do DP: o analista vê os SEUS.
 *  - `montarPainelContabilGestao`: o time inteiro — atividade, base, série de 6
 *    meses e o feed com nome de quem fez.
 *
 * Endpoints e permissões separados: o colaborador NÃO tem como buscar os
 * números do time (a rota `/painel-gestao` é de outra seção).
 *
 * Diferente do DP: o Contábil é uma bancada (conciliação, balancete,
 * implantação PRECISAM ser rodados por empresa/período), então o painel NÃO
 * dispara nada — ele mostra o que JÁ se rodou (contadores da trilha `auditoria`)
 * e a BASE configurada acumulada (`conf_*`). Materializa [[A home de um módulo é
 * o resumo que carrega sozinho; automação não abre sozinha]] — o avesso do
 * painel: aqui a home é o placar da automação, não a automação.
 *
 * Tudo é banco do app (nenhuma consulta ao Questor) — o painel carrega rápido e
 * não degrada por indisponibilidade do Questor. Cada bloco é independente
 * (`allSettled`). Os contadores e o feed respeitam o escopo de empresa da
 * sessão (a trilha guarda `codigoempresa`); a base é contagem pura.
 */

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function primeiroDiaMes(iso: string, nMeses = 0): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + nMeses, 1)).toISOString().slice(0, 10);
}

/**
 * Filtros da trilha: escopo de empresa da sessão e, quando `dono` vem, o recorte
 * por autor. Os `$n` são numerados na ordem em que entram — por isso o array de
 * params cresce junto com a condição, e não em dois passos.
 */
async function filtrosTrilha(
  base: unknown[],
  dono?: string
): Promise<{ cond: string; params: unknown[] }> {
  const params = [...base];
  let cond = "";

  const s = await getSessaoOpcional();
  const escopo = s ? empresasPermitidas(s) : [];
  if (escopo !== "todas") {
    params.push(escopo);
    // Eventos sem empresa (codigoempresa null) valem para todos — não escondê-los.
    cond += ` and (codigoempresa is null or codigoempresa = any($${params.length}::int[]))`;
  }
  if (dono) {
    params.push(dono);
    cond += ` and usuario_id = $${params.length}`;
  }
  return { cond, params };
}

const ACAO = {
  conciliacao: "contabil.conciliacao.gerar",
  implantacao: "contabil.implantacao.gerar",
  laudo: "contabil.laudo.gerar",
  triar: "contabil.pendencia.triar",
  export: "contabil.export",
} as const;

const ATIVIDADE_ZERO: ContabilAtividade = {
  conciliacoes: 0,
  conciliacaoLinhas: 0,
  implantacoes: 0,
  laudos: 0,
  pendenciasTriadas: 0,
  pendenciasResolvidas: 0,
  pendenciasIgnoradas: 0,
  exportacoes: 0,
};

/**
 * Contadores do que se rodou no mês (trilha de auditoria). Sem `dono` conta o
 * time todo (gestão); com `dono`, só aquela pessoa (colaborador).
 */
async function blocoAtividade(inicioMes: string, dono?: string): Promise<ContabilAtividade> {
  const { cond, params } = await filtrosTrilha([inicioMes], dono);
  const [row] = await appQuery<{
    conciliacoes: number;
    conciliacao_linhas: number;
    implantacoes: number;
    laudos: number;
    triadas: number;
    resolvidas: number;
    ignoradas: number;
    exportacoes: number;
  }>(
    `select
        count(*) filter (where acao = '${ACAO.conciliacao}')::int as conciliacoes,
        coalesce(sum(case when acao = '${ACAO.conciliacao}' then (detalhe->>'linhas')::int end), 0)::int as conciliacao_linhas,
        count(*) filter (where acao = '${ACAO.implantacao}')::int as implantacoes,
        count(*) filter (where acao = '${ACAO.laudo}')::int as laudos,
        count(*) filter (where acao = '${ACAO.triar}')::int as triadas,
        count(*) filter (where acao = '${ACAO.triar}' and detalhe->>'status' = 'resolvido')::int as resolvidas,
        count(*) filter (where acao = '${ACAO.triar}' and detalhe->>'status' = 'ignorado')::int as ignoradas,
        count(*) filter (where acao = '${ACAO.export}')::int as exportacoes
       from auditoria
      where modulo = 'contabil' and criado_em >= $1${cond}`,
    params
  );
  return {
    conciliacoes: row?.conciliacoes ?? 0,
    conciliacaoLinhas: row?.conciliacao_linhas ?? 0,
    implantacoes: row?.implantacoes ?? 0,
    laudos: row?.laudos ?? 0,
    pendenciasTriadas: row?.triadas ?? 0,
    pendenciasResolvidas: row?.resolvidas ?? 0,
    pendenciasIgnoradas: row?.ignoradas ?? 0,
    exportacoes: row?.exportacoes ?? 0,
  };
}

/** Tamanho da base configurada (contagem pura, sem escopo — são números, não dado). */
async function blocoBase(): Promise<ContabilBase> {
  const [row] = await appQuery<{
    plano: number;
    regras: number;
    regras_extrato: number;
    contas_banco: number;
    depara: number;
  }>(
    `select
        (select count(*) from conf_cfop_contabiliza)::int as plano,
        (select count(*) from conf_regra)::int as regras,
        (select count(*) from conf_regra_extrato where ativo)::int as regras_extrato,
        (select count(*) from conf_conta_banco)::int as contas_banco,
        (select count(*) from implantacao_depara)::int as depara`
  );
  return {
    plano: row?.plano ?? 0,
    regras: row?.regras ?? 0,
    regrasExtrato: row?.regras_extrato ?? 0,
    contasBanco: row?.contas_banco ?? 0,
    depara: row?.depara ?? 0,
  };
}

/** Série mensal (6 meses) dos trabalhos rodados pelo time. Só gestão. */
async function blocoSerie(inicio: string): Promise<ContabilSeriePonto[]> {
  const { cond, params } = await filtrosTrilha([inicio]);
  return appQuery<ContabilSeriePonto>(
    `select to_char(g.b, 'YYYY-MM') as bucket,
            count(a.id) filter (where a.acao = '${ACAO.conciliacao}')::int as conciliacoes,
            count(a.id) filter (where a.acao = '${ACAO.implantacao}')::int as implantacoes,
            count(a.id) filter (where a.acao = '${ACAO.laudo}')::int as laudos
       from generate_series(date_trunc('month', $1::date), date_trunc('month', current_date), interval '1 month') g(b)
       left join auditoria a
         on date_trunc('month', a.criado_em)::date = g.b::date
        and a.modulo = 'contabil'${cond}
      group by g.b
      order by g.b`,
    params
  );
}

/** Últimos eventos da trilha, no escopo. Com `dono`, só os da própria pessoa. */
async function blocoRecentes(dono?: string): Promise<ContabilEvento[]> {
  const { cond, params } = await filtrosTrilha([], dono);
  return appQuery<ContabilEvento>(
    `select id, usuario_nome as usuario, acao, alvo,
            to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as quando
       from auditoria
      where modulo = 'contabil'${cond}
      order by criado_em desc
      limit 12`,
    params
  );
}

function colher<T>(r: PromiseSettledResult<T>, nome: string): T | null {
  if (r.status === "fulfilled") return r.value;
  console.error(`[painel-contabil] bloco '${nome}' falhou:`, r.reason);
  return null;
}

/**
 * Painel do colaborador: recorte por dono. Sem sessão não há dono, e sem dono a
 * consulta traria o time inteiro — então devolve zerado em vez de vazar.
 */
export async function montarPainelContabilColaborador(): Promise<PainelContabilColaborador> {
  const fim = hojeISO();
  const inicio = primeiroDiaMes(fim);
  const dono = (await getSessaoOpcional())?.usuario.id;

  if (!dono) {
    return { periodo: { inicio, fim }, atividade: ATIVIDADE_ZERO, base: null, recentes: [] };
  }

  const [atividade, base, recentes] = await Promise.allSettled([
    blocoAtividade(inicio, dono),
    blocoBase(),
    blocoRecentes(dono),
  ]);

  return {
    periodo: { inicio, fim },
    atividade: colher(atividade, "atividade"),
    base: colher(base, "base"),
    recentes: colher(recentes, "recentes"),
  };
}

/** Painel de gestão: o time inteiro, sem recorte por dono. */
export async function montarPainelContabilGestao(): Promise<PainelContabilGestao> {
  const fim = hojeISO();
  const inicio = primeiroDiaMes(fim);
  const serie6m = primeiroDiaMes(fim, -5);

  const [atividade, base, serie, recentes] = await Promise.allSettled([
    blocoAtividade(inicio),
    blocoBase(),
    blocoSerie(serie6m),
    blocoRecentes(),
  ]);

  return {
    periodo: { inicio, fim },
    atividade: colher(atividade, "atividade"),
    base: colher(base, "base"),
    serie: colher(serie, "serie"),
    recentes: colher(recentes, "recentes"),
  };
}
