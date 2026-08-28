import "server-only";
import { appQuery } from "./app-db";
import { query } from "./db";
import { entregasPendentes, listarEmpresas, AcessoriasErro } from "./acessorias";
import type { EmpresaAcessorias } from "./acessorias";
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
 *    fila em `obr_entrega`. ~30 min; roda pelo cron, nunca dentro de um request.
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

/**
 * Guarda a carteira para o seletor. Upsert por CNPJ: empresa que sai da lista do
 * Acessórias não é apagada — ela pode ter entregas antigas ainda referenciadas, e
 * sumir do seletor faria a fila mostrar um CNPJ sem nome.
 */
async function guardarCarteira(
  empresas: EmpresaAcessorias[],
  mapa: Map<string, number>
): Promise<void> {
  if (!empresas.length) return;

  // Em lotes: um insert com milhares de linhas estoura o limite de parâmetros.
  const LOTE = 200;
  for (let i = 0; i < empresas.length; i += LOTE) {
    const fatia = empresas.slice(i, i + LOTE);
    const valores = fatia.map((e) => [
      e.Identificador,
      e.Razao?.trim() || e.Identificador,
      null,
      e.Status?.trim() || "?",
      mapa.get(soDigitos(e.Identificador)) ?? null,
    ]);
    const placeholders = valores
      .map((_, k) => `(${Array.from({ length: 5 }, (_, j) => `$${k * 5 + j + 1}`).join(",")})`)
      .join(",");
    await appQuery(
      `insert into obr_empresa (cnpj, razao, fantasia, status, codigoempresa)
       values ${placeholders}
       on conflict (cnpj) do update set
         razao = excluded.razao,
         status = excluded.status,
         codigoempresa = excluded.codigoempresa,
         atualizado_em = now()`,
      valores.flat()
    );
  }
}

/** Uma empresa da carteira, para o seletor. */
export interface EmpresaCarteira {
  cnpj: string;
  razao: string;
  status: string;
  codigoempresa: number | null;
  /** Tem entrega na fila agora? Ordena o seletor por quem importa. */
  temFila: boolean;
}

/**
 * Carteira visível para a sessão. Mesma regra de escopo da fila: sem par no
 * Questor, só quem vê todas — senão o seletor viraria um diretório de clientes
 * alheios para quem tem carteira restrita.
 */
export async function listarCarteira(): Promise<EmpresaCarteira[]> {
  const sessao = await getSessaoOpcional();
  const permitidas = sessao ? empresasPermitidas(sessao) : [];
  const cond = permitidas === "todas" ? "" : ` and e.codigoempresa = any($1::int[])`;
  const params = permitidas === "todas" ? [] : [permitidas];

  return appQuery<EmpresaCarteira>(
    `select e.cnpj, e.razao, e.status, e.codigoempresa,
            exists (select 1 from obr_entrega f where f.cnpj = e.cnpj) as "temFila"
       from obr_empresa e
      where e.status = 'Ativa'${cond}
      order by e.razao`,
    params
  );
}

export interface ResumoSync {
  empresas: number;
  entregas: number;
  falhas: number;
  duracaoMs: number;
  /** Encerrou por pedido de parada, não por ter terminado a carteira. */
  cancelada: boolean;
  /** Índice de onde partiu, quando retomou uma execução interrompida. */
  retomadaDe: number | null;
}

/** Estado ao vivo da varredura, para a tela de Configurações. */
export interface EstadoVarredura {
  id: string | null;
  rodando: boolean;
  progresso: number;
  total: number;
  entregas: number;
  falhas: number;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  erro: string | null;
  cancelamentoPedido: boolean;
  retomadaDe: number | null;
  /** Segundos estimados para o fim, pela média já observada. Null sem base. */
  restanteSegundos: number | null;
}

/**
 * A varredura só é retomável enquanto a lista de empresas ainda descreve a mesma
 * carteira. Depois disso, começar do zero é mais honesto que continuar de um
 * índice que aponta para outra empresa.
 */
const HORAS_RETOMAVEL = 24;

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

  // Retomada: uma execução interrompida nas últimas horas deixa por onde
  // continuar. É o que torna um restart de container um atraso, e não a perda de
  // meia hora de varredura.
  const [anterior] = await appQuery<{ progresso: number; total: number }>(
    `select progresso, total from obr_sync
      where concluido_em is not null
        and progresso > 0
        and progresso < total
        and iniciado_em > now() - ($1 || ' hours')::interval
      order by iniciado_em desc
      limit 1`,
    [String(HORAS_RETOMAVEL)]
  );
  const retomadaDe = anterior?.progresso ?? null;

  const [{ id: syncId }] = await appQuery<{ id: string }>(
    `insert into obr_sync (retomada_de) values ($1) returning id`,
    [retomadaDe]
  );

  const fim = hojeISO();
  const inicio = mesesAtras(fim, MESES_ATRAS);

  try {
    // A lista completa (ativas e inativas) alimenta o seletor; a varredura de
    // entregas percorre só as ativas. Buscar as duas é a MESMA chamada.
    const todasEmpresas = await listarEmpresas(false);
    const mapa = await mapaCnpjQuestor();
    const empresas = todasEmpresas.filter((e) => e.Status === "Ativa");
    const visto = new Date();

    await guardarCarteira(todasEmpresas, mapa);

    // Ordem ESTÁVEL: o índice de retomada só significa alguma coisa se a mesma
    // carteira produzir sempre a mesma sequência.
    empresas.sort((a, b) => a.Identificador.localeCompare(b.Identificador));
    await appQuery(`update obr_sync set total = $2 where id = $1`, [syncId, empresas.length]);

    const inicioIdx = retomadaDe != null && retomadaDe < empresas.length ? retomadaDe : 0;

    // Parada pedida ENQUANTO ela listava empresas. A listagem leva minutos e não
    // passa pelo laço abaixo, então sem esta checagem o botão ficava em
    // "Parando…" até a listagem acabar — o usuário pede para parar e nada
    // acontece, que é pior que não ter botão.
    const [antesDoLaco] = await appQuery<{ cancelar: boolean }>(
      `select cancelar from obr_sync where id = $1`,
      [syncId]
    );
    if (antesDoLaco?.cancelar) {
      await appQuery(
        `update obr_sync set concluido_em = now(), total = $2, erro = $3 where id = $1`,
        [syncId, empresas.length, "cancelada por pedido do usuário"]
      );
      return {
        empresas: 0, entregas: 0, falhas: 0, duracaoMs: Date.now() - t0,
        cancelada: true, retomadaDe,
      };
    }
    let entregas = 0;
    let falhas = 0;

    let processadas = inicioIdx;
    let cancelada = false;

    for (const emp of empresas.slice(inicioIdx)) {
      // Grava o progresso e LÊ o pedido de parada na mesma ida ao banco: é o que
      // permite checar cancelamento a cada empresa sem um round-trip extra.
      const [estado] = await appQuery<{ cancelar: boolean }>(
        `update obr_sync set progresso = $2, entregas = $3, falhas = $4
          where id = $1 returning cancelar`,
        [syncId, processadas, entregas, falhas]
      );
      if (estado?.cancelar) {
        cancelada = true;
        break;
      }
      processadas++;

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

    // O que não foi visto saiu da fila — mas só se a varredura percorreu a
    // carteira INTEIRA e sem falhas. Numa execução parcial (cancelada, retomada
    // pela metade, ou com empresas que erraram) "não visto" quer dizer "não
    // perguntado", e apagar produziria uma fila falsamente limpa.
    const completa = !cancelada && falhas === 0 && inicioIdx === 0;
    if (completa) {
      await appQuery(`delete from obr_entrega where visto_em < $1`, [visto]);
    }

    await appQuery(
      `update obr_sync
          set concluido_em = now(), empresas = $2, entregas = $3, falhas = $4,
              progresso = $5, erro = $6
        where id = $1`,
      [
        syncId,
        processadas,
        entregas,
        falhas,
        processadas,
        cancelada ? "cancelada por pedido do usuário" : null,
      ]
    );
    return {
      empresas: processadas,
      entregas,
      falhas,
      duracaoMs: Date.now() - t0,
      cancelada,
      retomadaDe,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appQuery(`update obr_sync set concluido_em = now(), erro = $2 where id = $1`, [
      syncId,
      msg,
    ]);
    throw err;
  }
}

/**
 * Consulta UMA empresa ao vivo e atualiza o retrato dela.
 *
 * É o avesso da varredura, e existe porque a API é rápida exatamente onde a
 * varredura é lenta: uma empresa custa UMA chamada (~1s), porque o CNPJ é a
 * única chave que `deliveries` aceita. O que não dá para ter ao vivo é o
 * ranking do escritório — esse só existe varrendo tudo.
 *
 * Grava o resultado em `obr_entrega`: consultar ao vivo faz o retrato daquela
 * empresa CONVERGIR para a realidade, em vez de deixar tela e painel contando
 * histórias diferentes. Só as linhas daquela empresa são tocadas.
 */
export async function sincronizarEmpresa(cnpj: string): Promise<EntregaFila[]> {
  const fim = hojeISO();
  const inicio = mesesAtras(fim, MESES_ATRAS);

  const lote = await entregasPendentes(cnpj, inicio, fim);
  const visto = new Date();

  // Par no Questor para UMA empresa: consulta pontual, não o mapa inteiro.
  const [par] = await query<{ codigoempresa: number }>(
    `select codigoempresa from estab
      where regexp_replace(coalesce(inscrfederal, ''), '[^0-9]', '', 'g') = $1
      limit 1`,
    [soDigitos(cnpj)]
  );
  const codigoempresa = par?.codigoempresa ?? null;

  if (lote.length) {
    const valores = lote.map((e) => [
      e.entId,
      e.cnpj,
      codigoempresa,
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
         cnpj = excluded.cnpj, codigoempresa = excluded.codigoempresa,
         empresa = excluded.empresa, obrigacao = excluded.obrigacao,
         competencia = excluded.competencia, prazo = excluded.prazo,
         status = excluded.status, multa = excluded.multa,
         dpto_id = excluded.dpto_id, dpto_nome = excluded.dpto_nome,
         resp_id = excluded.resp_id, resp_nome = excluded.resp_nome,
         visto_em = excluded.visto_em`,
      valores.flat()
    );
  }

  // O que esta empresa tinha e não tem mais saiu da fila (entregue, dispensado).
  // Recorte por CNPJ: nenhuma outra empresa é afetada.
  await appQuery(`delete from obr_entrega where cnpj = $1 and visto_em < $2`, [cnpj, visto]);

  return appQuery<EntregaFila>(
    `select ent_id as "entId", cnpj, codigoempresa, empresa, obrigacao,
            to_char(competencia, 'YYYY-MM-DD') as competencia,
            to_char(prazo, 'YYYY-MM-DD') as prazo,
            status, multa, dpto_id as "dptoId", dpto_nome as "dptoNome",
            resp_nome as "respNome",
            case when prazo is null then null else (current_date - prazo)::int end as "diasAtraso"
       from obr_entrega
      where cnpj = $1
      order by prazo asc nulls last`,
    [cnpj]
  );
}

/** O par no Questor de um CNPJ, para checar escopo antes de consultar. */
export async function empresaQuestorPorCnpj(cnpj: string): Promise<number | null> {
  const [par] = await query<{ codigoempresa: number }>(
    `select codigoempresa from estab
      where regexp_replace(coalesce(inscrfederal, ''), '[^0-9]', '', 'g') = $1
      limit 1`,
    [soDigitos(cnpj)]
  );
  return par?.codigoempresa ?? null;
}

/**
 * Estado ao vivo da varredura, para a tela de Configurações do módulo.
 *
 * A estimativa sai do RITMO OBSERVADO nesta execução (tempo decorrido dividido
 * pelas empresas já feitas), não de uma constante no código. Uma média que a
 * própria execução produziu acompanha o adaptativo do cliente da API — quando
 * ele desacelera por 429, a estimativa desacelera junto, em vez de prometer um
 * fim que não vem.
 */
export async function estadoVarredura(): Promise<EstadoVarredura> {
  const [r] = await appQuery<{
    id: string;
    progresso: number;
    total: number;
    entregas: number;
    falhas: number;
    cancelar: boolean;
    retomada_de: number | null;
    iniciado_em: string;
    concluido_em: string | null;
    erro: string | null;
    segundos: number;
    aberta: boolean;
  }>(
    `select id, progresso, total, entregas, falhas, cancelar, retomada_de,
            to_char(iniciado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as iniciado_em,
            to_char(concluido_em, 'YYYY-MM-DD"T"HH24:MI:SS') as concluido_em,
            erro,
            extract(epoch from (coalesce(concluido_em, now()) - iniciado_em))::int as segundos,
            (concluido_em is null and iniciado_em > now() - ($1 || ' hours')::interval) as aberta
       from obr_sync
      order by iniciado_em desc
      limit 1`,
    [String(HORAS_ATE_ABANDONADA)]
  );

  if (!r) {
    return {
      id: null, rodando: false, progresso: 0, total: 0, entregas: 0, falhas: 0,
      iniciadoEm: null, concluidoEm: null, erro: null, cancelamentoPedido: false,
      retomadaDe: null, restanteSegundos: null,
    };
  }

  // Só conta o que ESTA execução andou: numa retomada, o progresso já começa
  // alto e dividir por ele daria um ritmo fantasma.
  const feitasAgora = r.progresso - (r.retomada_de ?? 0);
  const faltam = Math.max(0, r.total - r.progresso);
  const restanteSegundos =
    r.aberta && feitasAgora > 5 && r.segundos > 0
      ? Math.round((r.segundos / feitasAgora) * faltam)
      : null;

  return {
    id: r.id,
    rodando: r.aberta,
    progresso: r.progresso,
    total: r.total,
    entregas: r.entregas,
    falhas: r.falhas,
    iniciadoEm: r.iniciado_em,
    concluidoEm: r.concluido_em,
    erro: r.erro,
    cancelamentoPedido: r.cancelar,
    retomadaDe: r.retomada_de,
    restanteSegundos,
  };
}

/**
 * Pede parada. Não mata nada: marca a flag que a varredura relê a cada empresa,
 * então ela encerra no fim do ciclo corrente, com a linha fechada e o progresso
 * preservado para a retomada. Matar o processo também pararia — e deixaria a
 * linha órfã e o ponto de retomada perdido.
 */
export async function pedirParadaVarredura(): Promise<boolean> {
  const linhas = await appQuery<{ id: string }>(
    `update obr_sync set cancelar = true where concluido_em is null returning id`
  );
  // Nenhuma linha aberta = não havia o que parar; a tela diz isso em vez de
  // fingir que parou algo.
  return linhas.length > 0;
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
 * Recortes que o usuário escolhe na tela. Todos opcionais e independentes; cada
 * um vira uma condição a mais no MESMO funil, para não haver dois caminhos de
 * filtro discordando ([[Filtro transversal só é honesto se todo o funil o
 * honra]]).
 */
export interface FiltrosFila {
  /** Uma empresa (CNPJ do Acessórias). */
  cnpj?: string;
  /** Um responsável pelo prazo (id do Acessórias). */
  respId?: number;
  /** Janela de PRAZO — a data que define atraso, e por isso a que se filtra. */
  prazoDe?: string;
  prazoAte?: string;
  /** Janela de COMPETÊNCIA — o mês do fato, não o do vencimento. */
  competenciaDe?: string;
  competenciaAte?: string;
  /** Só o que já venceu. */
  soVencidas?: boolean;
  /** Só o que gera multa. */
  soMulta?: boolean;
  /** Uma obrigação específica (o nome, como o Acessórias escreve). */
  obrigacao?: string;
}

function condFiltros(f: FiltrosFila | undefined, params: unknown[]): string {
  if (!f) return "";
  let cond = "";
  const add = (sql: string, valor: unknown) => {
    params.push(valor);
    cond += sql.replace("$?", `$${params.length}`);
  };

  if (f.cnpj) add(" and cnpj = $?", f.cnpj);
  if (f.respId != null) add(" and resp_id = $?", f.respId);
  if (f.prazoDe) add(" and prazo >= $?::date", f.prazoDe);
  if (f.prazoAte) add(" and prazo <= $?::date", f.prazoAte);
  if (f.competenciaDe) add(" and competencia >= $?::date", f.competenciaDe);
  if (f.competenciaAte) add(" and competencia <= $?::date", f.competenciaAte);
  if (f.obrigacao) add(" and obrigacao = $?", f.obrigacao);
  // Vencida = tem prazo E ele passou. Sem prazo não é vencida nem no prazo.
  if (f.soVencidas) cond += " and prazo is not null and prazo < current_date";
  if (f.soMulta) cond += " and multa";
  return cond;
}

/**
 * Painel do módulo: placar, recortes por setor/responsável/obrigação e a fila.
 * `setores` recorta tudo — é como a seção Contábil vira "só os setores contábeis"
 * sem existir uma tabela por setor.
 */
export async function montarPainelObrigacoes(
  setores?: number[],
  filtros?: FiltrosFila
): Promise<PainelObrigacoes> {
  const sync = await blocoSync();
  const base = await escopo();

  const p = [...base.params];
  // Ordem importa: cada função ACRESCENTA a `p` e numera o `$n` pelo tamanho
  // atual, então a string só está correta se construída na mesma sequência.
  const onde = `where true${base.cond}${condSetor(setores, p)}${condFiltros(filtros, p)}`;

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
