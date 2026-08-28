import "server-only";
import { appQuery } from "./app-db";
import { query } from "./db";
import { entregasPendentes, listarEmpresas, AcessoriasErro } from "./acessorias";
import { getSessaoOpcional, empresasPermitidas } from "./sessao";
import type {
  EntregaFila,
  ObrigacaoFila,
  PainelObrigacoes,
  ResponsavelFila,
  SetorFila,
  SincronizacaoInfo,
} from "./obrigacoes-tipos";

/**
 * MÓDULO OBRIGAÇÕES — a fila do Acessórias, sincronizada e lida.
 *
 * Duas metades bem separadas:
 *
 *  - `sincronizarObrigacoes`: o job. Varre a carteira na API (uma chamada por
 *    empresa, ver `acessorias.ts`), resolve o par no Questor e materializa a
 *    fila em `obr_entrega`. Roda pelo cron, nunca dentro de um request.
 *  - `montarPainelObrigacoes`: a leitura. Só banco do app + o escopo da sessão;
 *    abre instantânea porque não toca a API.
 *
 * O recorte por empresa é o de sempre ([[Escopo de dado se clampa no servidor,
 * num funil só]]), com uma diferença que a fonte impõe: 10% das empresas do
 * Acessórias não existem no Questor (filiais e clientes que só usam o outro
 * sistema), e para essas não há `codigoempresa` com que recortar. Elas ficam
 * visíveis apenas a quem vê TODAS as empresas — o contrário de tratá-las como
 * "de todo mundo", que vazaria carteira alheia.
 */

// ── Sincronização ────────────────────────────────────────────────────────────

/** Janela varrida. Fila é o que está em aberto; o passado longe não é trabalho. */
const MESES_ATRAS = 18;

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mesesAtras(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - n, d)).toISOString().slice(0, 10);
}

/** Só os dígitos: o Acessórias formata o CNPJ, o Questor às vezes não. */
function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * CNPJ (só dígitos) -> codigoempresa do Questor. Casa por QUALQUER
 * estabelecimento, não só a matriz: o Acessórias cadastra filial como empresa
 * própria, e casar só por `codigoestab = 1` perdia 179 numa amostra de 1.200
 * (medido em ago/2026).
 */
async function mapaCnpjQuestor(): Promise<Map<string, number>> {
  const linhas = await query<{ codigoempresa: number; inscrfederal: string }>(
    `select codigoempresa, inscrfederal
       from estab
      where inscrfederal is not null and btrim(inscrfederal) <> ''`
  );
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    const k = soDigitos(l.inscrfederal);
    // Primeiro a ganhar: um CNPJ não deveria repetir entre empresas, e se
    // repetir, sobrescrever escolheria em silêncio.
    if (k && !mapa.has(k)) mapa.set(k, l.codigoempresa);
  }
  return mapa;
}

/**
 * Depois disso, uma varredura sem conclusão é considerada ABANDONADA, não em
 * andamento. Um processo morto no meio (deploy, restart, kill) deixa a linha
 * aberta para sempre, e a tela passaria a dizer "sincronizando agora" eternamente
 * — foi o que aconteceu na primeira execução real. A janela é generosa porque a
 * varredura legitimamente leva horas.
 */
const HORAS_ATE_ABANDONADA = 8;

export interface ResumoSync {
  empresas: number;
  entregas: number;
  falhas: number;
  duracaoMs: number;
}

/**
 * Varre a carteira e materializa a fila. Idempotente: `ent_id` é a chave, então
 * rodar duas vezes atualiza em vez de duplicar, e o que saiu da fila (foi
 * entregue, dispensado) some porque não foi visto nesta varredura.
 *
 * Uma empresa que falha NÃO derruba a varredura — conta em `falhas`, e a tela
 * avisa que a fila está incompleta. Derrubar tudo por uma empresa transformaria
 * um erro pontual em ausência total de dado.
 */
export async function sincronizarObrigacoes(): Promise<ResumoSync> {
  const t0 = Date.now();

  // Fecha o que ficou aberto de execuções mortas antes de abrir a nossa: sem
  // isso a linha órfã segue contando como "rodando".
  await appQuery(
    `update obr_sync
        set concluido_em = now(), erro = 'abandonada: processo encerrado antes de concluir'
      where concluido_em is null
        and iniciado_em < now() - ($1 || ' hours')::interval`,
    [String(HORAS_ATE_ABANDONADA)]
  );

  const [{ id: syncId }] = await appQuery<{ id: string }>(
    `insert into obr_sync default values returning id`
  );

  const fim = hojeISO();
  const inicio = mesesAtras(fim, MESES_ATRAS);

  try {
    const [empresas, mapa] = await Promise.all([listarEmpresas(true), mapaCnpjQuestor()]);
    const visto = new Date();
    let entregas = 0;
    let falhas = 0;

    for (const emp of empresas) {
      let lote;
      try {
        lote = await entregasPendentes(emp.Identificador, inicio, fim);
      } catch (err) {
        falhas++;
        console.error(
          `[obrigacoes] empresa ${emp.Identificador} falhou:`,
          err instanceof AcessoriasErro ? err.message : err
        );
        continue;
      }
      if (!lote.length) continue;

      // Um insert por empresa (não por linha): a carteira passa de mil empresas
      // e uma ida ao banco por entrega seria um gargalo nosso somado ao da API.
      const valores = lote.map((e) => [
        e.entId,
        e.cnpj,
        mapa.get(soDigitos(e.cnpj)) ?? null,
        e.empresa,
        e.obrigacao,
        e.competencia,
        e.prazo,
        e.status,
        e.multa,
        e.dptoId,
        e.dptoNome,
        e.respId,
        e.respNome,
        visto,
      ]);
      const placeholders = valores
        .map((_, i) => `(${Array.from({ length: 14 }, (_, j) => `$${i * 14 + j + 1}`).join(",")})`)
        .join(",");

      await appQuery(
        `insert into obr_entrega
           (ent_id, cnpj, codigoempresa, empresa, obrigacao, competencia, prazo,
            status, multa, dpto_id, dpto_nome, resp_id, resp_nome, visto_em)
         values ${placeholders}
         on conflict (ent_id) do update set
           cnpj = excluded.cnpj,
           codigoempresa = excluded.codigoempresa,
           empresa = excluded.empresa,
           obrigacao = excluded.obrigacao,
           competencia = excluded.competencia,
           prazo = excluded.prazo,
           status = excluded.status,
           multa = excluded.multa,
           dpto_id = excluded.dpto_id,
           dpto_nome = excluded.dpto_nome,
           resp_id = excluded.resp_id,
           resp_nome = excluded.resp_nome,
           visto_em = excluded.visto_em`,
        valores.flat()
      );
      entregas += lote.length;
    }

    // O que não foi visto saiu da fila. Só apaga se a varredura foi íntegra o
    // bastante: com muitas falhas, "não visto" pode ser "não perguntado", e
    // apagar viraria uma fila falsamente limpa.
    if (falhas === 0) {
      await appQuery(`delete from obr_entrega where visto_em < $1`, [visto]);
    }

    await appQuery(
      `update obr_sync set concluido_em = now(), empresas = $2, entregas = $3, falhas = $4
        where id = $1`,
      [syncId, empresas.length, entregas, falhas]
    );
    return { empresas: empresas.length, entregas, falhas, duracaoMs: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appQuery(`update obr_sync set concluido_em = now(), erro = $2 where id = $1`, [
      syncId,
      msg,
    ]);
    throw err;
  }
}

/** Já existe uma varredura em andamento (e não abandonada)? */
export async function sincronizacaoEmAndamento(): Promise<boolean> {
  const [row] = await appQuery<{ rodando: boolean }>(
    `select exists (
       select 1 from obr_sync
        where concluido_em is null
          and iniciado_em > now() - ($1 || ' hours')::interval
     ) as rodando`,
    [String(HORAS_ATE_ABANDONADA)]
  );
  return row?.rodando ?? false;
}

// ── Leitura ──────────────────────────────────────────────────────────────────

/**
 * Recorte de empresa para a fila. Quem vê todas não filtra; quem não vê fica com
 * as suas E PERDE as linhas sem par no Questor (`codigoempresa is null`), que
 * são carteira que não dá para atribuir.
 */
async function escopo(): Promise<{ cond: string; params: unknown[] }> {
  const s = await getSessaoOpcional();
  const permitidas = s ? empresasPermitidas(s) : [];
  if (permitidas === "todas") return { cond: "", params: [] };
  return { cond: ` and codigoempresa = any($1::int[])`, params: [permitidas] };
}

async function blocoSync(): Promise<SincronizacaoInfo> {
  const [row] = await appQuery<{
    concluido_em: string | null;
    rodando: boolean;
    empresas: number;
    entregas: number;
    falhas: number;
  }>(
    `select to_char(u.concluido_em, 'YYYY-MM-DD"T"HH24:MI:SS') as concluido_em,
            exists (
              select 1 from obr_sync
               where concluido_em is null
                 and iniciado_em > now() - interval '8 hours'
            ) as rodando,
            coalesce(u.empresas, 0) as empresas,
            coalesce(u.entregas, 0) as entregas,
            coalesce(u.falhas, 0) as falhas
       from (select * from obr_sync where concluido_em is not null and erro is null
              order by concluido_em desc limit 1) u
      right join (select 1) x on true`
  );
  return {
    concluidoEm: row?.concluido_em ?? null,
    rodando: row?.rodando ?? false,
    empresas: row?.empresas ?? 0,
    entregas: row?.entregas ?? 0,
    falhas: row?.falhas ?? 0,
  };
}

/** Filtro opcional de setor, somado ao escopo. */
function condSetor(setores: number[] | undefined, params: unknown[]): string {
  if (!setores?.length) return "";
  params.push(setores);
  return ` and dpto_id = any($${params.length}::int[])`;
}

/**
 * Painel do módulo: placar, recortes por setor/responsável/obrigação e a fila.
 * `setores` recorta tudo — é como a seção Contábil vira "só os setores contábeis"
 * sem existir uma tabela por setor.
 */
export async function montarPainelObrigacoes(setores?: number[]): Promise<PainelObrigacoes> {
  const sync = await blocoSync();
  const base = await escopo();

  const p = [...base.params];
  const onde = `where true${base.cond}${condSetor(setores, p)}`;

  const [totais, setoresRows, responsaveis, obrigacoes, fila] = await Promise.allSettled([
    appQuery<{ total: number; atrasadas: number; com_multa: number; sem_par: number }>(
      `select count(*)::int as total,
              count(*) filter (where prazo is not null and prazo < current_date)::int as atrasadas,
              count(*) filter (where multa)::int as com_multa,
              count(*) filter (where codigoempresa is null)::int as sem_par
         from obr_entrega ${onde}`,
      p
    ),
    appQuery<SetorFila>(
      `select dpto_id as "dptoId", dpto_nome as "dptoNome",
              count(*)::int as total,
              count(*) filter (where prazo is not null and prazo < current_date)::int as atrasadas,
              count(*) filter (where multa)::int as "comMulta"
         from obr_entrega ${onde}
        group by dpto_id, dpto_nome
        order by count(*) desc`,
      p
    ),
    appQuery<ResponsavelFila>(
      `select resp_id as "respId",
              coalesce(nullif(btrim(resp_nome), ''), '(sem responsável)') as "respNome",
              count(*)::int as total,
              count(*) filter (where prazo is not null and prazo < current_date)::int as atrasadas,
              count(*) filter (where multa)::int as "comMulta",
              max(current_date - prazo) filter (where prazo is not null and prazo < current_date)::int as "piorAtraso"
         from obr_entrega ${onde}
        group by resp_id, coalesce(nullif(btrim(resp_nome), ''), '(sem responsável)')
        order by count(*) filter (where prazo is not null and prazo < current_date) desc, count(*) desc`,
      p
    ),
    appQuery<ObrigacaoFila>(
      `select obrigacao,
              count(*)::int as total,
              count(*) filter (where prazo is not null and prazo < current_date)::int as atrasadas
         from obr_entrega ${onde}
        group by obrigacao
        order by count(*) desc
        limit 20`,
      p
    ),
    appQuery<EntregaFila>(
      `select ent_id as "entId", cnpj, codigoempresa, empresa, obrigacao,
              to_char(competencia, 'YYYY-MM-DD') as competencia,
              to_char(prazo, 'YYYY-MM-DD') as prazo,
              status, multa, dpto_id as "dptoId", dpto_nome as "dptoNome",
              resp_nome as "respNome",
              case when prazo is null then null else (current_date - prazo)::int end as "diasAtraso"
         from obr_entrega ${onde}
        order by prazo asc nulls last
        limit 500`,
      p
    ),
  ]);

  const colher = <T,>(r: PromiseSettledResult<T>, nome: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    console.error(`[obrigacoes] bloco '${nome}' falhou:`, r.reason);
    return null;
  };

  const t = colher(totais, "totais")?.[0];
  return {
    sync,
    total: t?.total ?? 0,
    atrasadas: t?.atrasadas ?? 0,
    comMulta: t?.com_multa ?? 0,
    semParNoQuestor: t?.sem_par ?? 0,
    setores: colher(setoresRows, "setores"),
    responsaveis: colher(responsaveis, "responsaveis"),
    obrigacoes: colher(obrigacoes, "obrigacoes"),
    fila: colher(fila, "fila"),
  };
}
