import "server-only";
import { appQuery } from "./app-db";
import { FilterError } from "./fiscal-filters";
import { criarEnvio, type ColaboradorEntrada, type DestinatarioEntrada } from "./envios";
import { listarDiretorio } from "./rh-diretorio";
import type { FuncionarioDiretorio } from "./rh-tipos";

/**
 * Regras de envio AUTOMÁTICO recorrente (envio_regra, migration 025). Cada regra
 * liga um formulário a uma periodicidade e um público; o job as materializa em
 * campanhas (reusa `criarEnvio`) e avança o próximo disparo. O scheduler embutido
 * bate /api/rh/cron/envios, que chama `processarRegrasRecorrentes`.
 */

export type DestinatarioTipo = "gestores" | "colaboradores";
export type Escopo = "generico" | "sobre_colaborador";
export type AlvoTipo = "todos" | "setores" | "colaboradores";
export type FreqTipo = "dias" | "mensal";

/** Ref. de colaborador no alvo (modo 'colaboradores'). */
export interface AlvoColaborador {
  empresa: number;
  contrato: number;
}

export interface EnvioRegra {
  id: number;
  formularioId: number;
  formularioNome: string;
  titulo: string | null;
  mensagem: string | null;
  destinatarioTipo: DestinatarioTipo;
  escopo: Escopo;
  alvoTipo: AlvoTipo;
  alvo: string[] | AlvoColaborador[];
  freqTipo: FreqTipo;
  freqValor: number;
  ativo: boolean;
  ultimoDisparo: string | null;
  proximoDisparo: string;
}

export interface EnvioRegraEntrada {
  formularioId: number;
  titulo?: string | null;
  mensagem?: string | null;
  destinatarioTipo: DestinatarioTipo;
  escopo?: Escopo;
  alvoTipo: AlvoTipo;
  alvo?: string[] | AlvoColaborador[];
  freqTipo: FreqTipo;
  freqValor: number;
  ativo?: boolean;
}

// ── Periodicidade ─────────────────────────────────────────────────────────────

/** Próximo disparo a partir de `base`. dias: base + N dias; mensal: próxima
 *  ocorrência do dia `freqValor` do mês (estritamente depois de base). */
export function proximoDisparo(freqTipo: FreqTipo, freqValor: number, base: Date): Date {
  if (freqTipo === "dias") {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + Math.max(1, Math.round(freqValor)));
    return d;
  }
  const dia = Math.min(28, Math.max(1, Math.round(freqValor)));
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dia, 8, 0, 0));
  if (d <= base) d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

// ── Validação/normalização ────────────────────────────────────────────────────

function normalizar(e: EnvioRegraEntrada): Required<Omit<EnvioRegraEntrada, "titulo" | "mensagem" | "ativo">> & {
  titulo: string | null;
  mensagem: string | null;
  ativo: boolean;
} {
  if (!Number.isInteger(e.formularioId)) throw new FilterError("Escolha um formulário");
  const destinatarioTipo = e.destinatarioTipo;
  if (destinatarioTipo !== "gestores" && destinatarioTipo !== "colaboradores") {
    throw new FilterError("Destinatário inválido");
  }
  // Escopo 'sobre_colaborador' só faz sentido com o gestor respondendo.
  const escopo: Escopo =
    destinatarioTipo === "gestores" && e.escopo === "sobre_colaborador"
      ? "sobre_colaborador"
      : "generico";
  const alvoTipo = e.alvoTipo;
  if (!["todos", "setores", "colaboradores"].includes(alvoTipo)) {
    throw new FilterError("Alvo inválido");
  }
  let alvo: string[] | AlvoColaborador[] = [];
  if (alvoTipo === "setores") {
    alvo = (Array.isArray(e.alvo) ? e.alvo : [])
      .map((x) => String(x).trim())
      .filter(Boolean) as string[];
    if (!alvo.length) throw new FilterError("Selecione ao menos um setor");
  } else if (alvoTipo === "colaboradores") {
    alvo = (Array.isArray(e.alvo) ? e.alvo : [])
      .map((x) => x as AlvoColaborador)
      .filter((c) => Number.isInteger(c?.empresa) && Number.isInteger(c?.contrato));
    if (!alvo.length) throw new FilterError("Selecione ao menos um colaborador");
  }
  const freqTipo = e.freqTipo;
  if (freqTipo !== "dias" && freqTipo !== "mensal") throw new FilterError("Frequência inválida");
  const freqValor = Math.round(Number(e.freqValor));
  if (freqTipo === "dias" && (!Number.isFinite(freqValor) || freqValor < 1)) {
    throw new FilterError("Informe a cada quantos dias (mínimo 1)");
  }
  if (freqTipo === "mensal" && (freqValor < 1 || freqValor > 28)) {
    throw new FilterError("O dia do mês deve estar entre 1 e 28");
  }
  return {
    formularioId: e.formularioId,
    titulo: e.titulo?.trim() || null,
    mensagem: e.mensagem?.trim() || null,
    destinatarioTipo,
    escopo,
    alvoTipo,
    alvo,
    freqTipo,
    freqValor,
    ativo: e.ativo !== false,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

interface RegraRow {
  id: number;
  formulario_id: number;
  formulario_nome: string;
  titulo: string | null;
  mensagem: string | null;
  destinatario_tipo: DestinatarioTipo;
  escopo: Escopo;
  alvo_tipo: AlvoTipo;
  alvo: string[] | AlvoColaborador[];
  freq_tipo: FreqTipo;
  freq_valor: number;
  ativo: boolean;
  ultimo_disparo: string | null;
  proximo_disparo: string;
}

const SELECT = `select r.id, r.formulario_id, f.nome as formulario_nome, r.titulo, r.mensagem,
        r.destinatario_tipo, r.escopo, r.alvo_tipo, r.alvo, r.freq_tipo, r.freq_valor, r.ativo,
        to_char(r.ultimo_disparo, 'YYYY-MM-DD"T"HH24:MI:SS') as ultimo_disparo,
        to_char(r.proximo_disparo, 'YYYY-MM-DD"T"HH24:MI:SS') as proximo_disparo
   from envio_regra r join formulario f on f.id = r.formulario_id`;

function daRow(r: RegraRow): EnvioRegra {
  return {
    id: r.id,
    formularioId: r.formulario_id,
    formularioNome: r.formulario_nome,
    titulo: r.titulo,
    mensagem: r.mensagem,
    destinatarioTipo: r.destinatario_tipo,
    escopo: r.escopo,
    alvoTipo: r.alvo_tipo,
    alvo: r.alvo ?? [],
    freqTipo: r.freq_tipo,
    freqValor: r.freq_valor,
    ativo: r.ativo,
    ultimoDisparo: r.ultimo_disparo,
    proximoDisparo: r.proximo_disparo,
  };
}

export async function listarRegras(): Promise<EnvioRegra[]> {
  const rows = await appQuery<RegraRow>(`${SELECT} order by r.ativo desc, r.proximo_disparo`);
  return rows.map(daRow);
}

export async function criarRegra(
  entrada: EnvioRegraEntrada,
  criadoPor?: string | null
): Promise<EnvioRegra> {
  const n = normalizar(entrada);
  const prox = proximoDisparo(n.freqTipo, n.freqValor, new Date());
  const [row] = await appQuery<RegraRow>(
    `with novo as (
       insert into envio_regra
         (formulario_id, titulo, mensagem, destinatario_tipo, escopo, alvo_tipo, alvo,
          freq_tipo, freq_valor, ativo, proximo_disparo, criado_por)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)
       returning *
     )
     ${SELECT.replace("from envio_regra r", "from novo r")} where true`,
    [
      n.formularioId, n.titulo, n.mensagem, n.destinatarioTipo, n.escopo, n.alvoTipo,
      JSON.stringify(n.alvo), n.freqTipo, n.freqValor, n.ativo, prox.toISOString(), criadoPor ?? null,
    ]
  );
  return daRow(row);
}

export async function atualizarRegra(id: number, entrada: EnvioRegraEntrada): Promise<EnvioRegra> {
  const n = normalizar(entrada);
  const prox = proximoDisparo(n.freqTipo, n.freqValor, new Date());
  const [row] = await appQuery<RegraRow>(
    `with upd as (
       update envio_regra set
         formulario_id = $2, titulo = $3, mensagem = $4, destinatario_tipo = $5, escopo = $6,
         alvo_tipo = $7, alvo = $8::jsonb, freq_tipo = $9, freq_valor = $10, ativo = $11,
         proximo_disparo = $12
       where id = $1
       returning *
     )
     ${SELECT.replace("from envio_regra r", "from upd r")} where true`,
    [
      id, n.formularioId, n.titulo, n.mensagem, n.destinatarioTipo, n.escopo, n.alvoTipo,
      JSON.stringify(n.alvo), n.freqTipo, n.freqValor, n.ativo, prox.toISOString(),
    ]
  );
  if (!row) throw new FilterError("Regra não encontrada");
  return daRow(row);
}

export async function excluirRegra(id: number): Promise<void> {
  await appQuery(`delete from envio_regra where id = $1`, [id]);
}

// ── Resolução de alvo + disparo do job ────────────────────────────────────────

/** Gestores ativos (todos), para resolver o público 'gestores'. */
async function gestoresAtivos(): Promise<{ classiforgan: string; nome: string; email: string }[]> {
  return appQuery(
    `select classiforgan, nome, email::text as email from rh_setor_gestor where ativo`
  );
}

/** Colaboradores do Diretório que casam com o alvo da regra. */
function filtrarColaboradores(
  todos: FuncionarioDiretorio[],
  alvoTipo: AlvoTipo,
  alvo: string[] | AlvoColaborador[]
): FuncionarioDiretorio[] {
  if (alvoTipo === "todos") return todos;
  if (alvoTipo === "setores") {
    const setores = new Set(alvo as string[]);
    return todos.filter((f) => f.classiforgan != null && setores.has(f.classiforgan));
  }
  const chaves = new Set((alvo as AlvoColaborador[]).map((c) => `${c.empresa}:${c.contrato}`));
  return todos.filter((f) => chaves.has(`${f.codigoempresa}:${f.contrato}`));
}

interface ParamsDisparo {
  destinatarios?: DestinatarioEntrada[];
  colaboradores?: ColaboradorEntrada[];
}

/** Traduz uma regra nos parâmetros do `criarEnvio` (resolvendo o público hoje). */
async function resolverDisparo(regra: EnvioRegra): Promise<ParamsDisparo> {
  const diretorio = await listarDiretorio();
  const colaboradoresAlvo = filtrarColaboradores(diretorio, regra.alvoTipo, regra.alvo);

  if (regra.destinatarioTipo === "gestores" && regra.escopo === "sobre_colaborador") {
    return {
      colaboradores: colaboradoresAlvo.map((f) => ({
        codigoempresa: f.codigoempresa,
        codigofunccontr: f.contrato,
        nome: f.nome,
        classiforgan: f.classiforgan,
      })),
    };
  }

  if (regra.destinatarioTipo === "gestores") {
    // Genérico: e-mails dos gestores do público. 'todos' = todos os gestores;
    // 'setores' = gestores desses setores; 'colaboradores' = gestores dos deptos
    // dos colaboradores escolhidos.
    const gestores = await gestoresAtivos();
    let setores: Set<string>;
    if (regra.alvoTipo === "todos") setores = new Set(gestores.map((g) => g.classiforgan));
    else if (regra.alvoTipo === "setores") setores = new Set(regra.alvo as string[]);
    else setores = new Set(colaboradoresAlvo.map((f) => f.classiforgan).filter(Boolean) as string[]);
    return {
      destinatarios: gestores
        .filter((g) => setores.has(g.classiforgan))
        .map((g) => ({ email: g.email, nome: g.nome })),
    };
  }

  // Colaboradores respondendo direto: só quem tem e-mail cadastrado.
  return {
    destinatarios: colaboradoresAlvo
      .filter((f) => f.email)
      .map((f) => ({ email: f.email as string, nome: f.nome })),
  };
}

export interface ResumoRegras {
  regras: number;
  disparadas: number;
  enviados: number;
  semAlvo: number;
  erros: number;
}

/** Job: dispara as regras ativas cujo próximo disparo já chegou e reprograma. */
export async function processarRegrasRecorrentes(): Promise<ResumoRegras> {
  const rows = await appQuery<RegraRow>(
    `${SELECT} where r.ativo and r.proximo_disparo <= now() order by r.proximo_disparo`
  );
  const resumo: ResumoRegras = { regras: rows.length, disparadas: 0, enviados: 0, semAlvo: 0, erros: 0 };

  for (const row of rows) {
    const regra = daRow(row);
    const prox = proximoDisparo(regra.freqTipo, regra.freqValor, new Date());
    try {
      const params = await resolverDisparo(regra);
      const temAlvo = (params.destinatarios?.length ?? 0) + (params.colaboradores?.length ?? 0) > 0;
      if (!temAlvo) {
        resumo.semAlvo++;
      } else {
        const r = await criarEnvio({
          formularioId: regra.formularioId,
          titulo: regra.titulo,
          mensagem: regra.mensagem,
          destinatarios: params.destinatarios,
          colaboradores: params.colaboradores,
        });
        resumo.disparadas++;
        resumo.enviados += r.enviados;
      }
    } catch (err) {
      resumo.erros++;
      console.error("[envio-regras] falha ao disparar regra", regra.id, err);
    }
    // Reprograma sempre (mesmo sem alvo/erro) para não repetir a cada 15 min.
    await appQuery(
      `update envio_regra set ultimo_disparo = now(), proximo_disparo = $2 where id = $1`,
      [regra.id, prox.toISOString()]
    );
  }
  return resumo;
}
