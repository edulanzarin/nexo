import type { RescisaoSituacao } from "./rescisoes-tipos";

/**
 * Tipos dos Painéis do DP. São DOIS painéis, home do módulo por cargo:
 *
 *  - **Colaborador** (`PainelColaborador`): a fila de trabalho — só PENDÊNCIAS
 *    (o que cobra ação) e as mais urgentes em lista. Nada de produtividade nem
 *    ranking de colegas (a tela é vista pelos funcionários).
 *  - **Gestão** (`PainelGestao`): a visão do gestor — pendências + a ATIVIDADE do
 *    DP no mês (quanto cada trabalho movimentou, ranking de quem fez, série).
 *
 * Cada bloco é INDEPENDENTE e opcional (`| null`): se a consulta daquele bloco
 * falha, o painel ainda renderiza os outros.
 */

// ── Blocos de pendência (comuns aos dois painéis) ────────────────────────────

/** Rescisões a pagar em aberto. */
export interface PainelRescisoes {
  pendentes: number;
  vencidas: number;
  venceBreve: number;
}

/** Férias vencidas (dobro) e a vencer, no escritório todo. */
export interface PainelFerias {
  vencidas: number;
  aVencer: number;
}

/** eSocial a resolver: transmissões pendentes e rejeitadas (últimos 90 dias). */
export interface PainelEsocial {
  pendentes: number;
  rejeitados: number;
}

// ── Itens das listas de prioridade (painel do colaborador) ───────────────────

/** Uma rescisão na lista "mais urgentes". */
export interface PainelRescisaoUrgente {
  codigoempresa: number;
  empresa: string;
  contrato: number;
  funcionario: string;
  prazo: string;
  diasParaPrazo: number | null;
  situacao: RescisaoSituacao;
}

/** Um funcionário na lista "férias mais críticas". */
export interface PainelFeriasCritica {
  codigoempresa: number;
  empresa: string;
  contrato: number;
  funcionario: string;
  periodosVencidos: number;
  diasParaLimite: number;
}

// ── Blocos de atividade (só painel de gestão) ────────────────────────────────

/** Contagem dos quatro trabalhos do DP num período. */
export interface PainelTrabalhos {
  avisos: number;
  rescisoes: number;
  admissoes: number;
  ferias: number;
  total: number;
}

/** Um operador do DP e quanto fez no período. */
export interface PainelOperador {
  nome: string;
  total: number;
}

/** O que o DP fez no mês corrente, com comparação ao período anterior. */
export interface PainelAtividade {
  mes: PainelTrabalhos;
  anterior: PainelTrabalhos;
  colaboradores: number;
  topOperadores: PainelOperador[];
}

/** Um ponto da série mensal dos quatro trabalhos. */
export interface PainelSeriePonto {
  bucket: string; // "YYYY-MM"
  avisos: number;
  rescisoes: number;
  admissoes: number;
  ferias: number;
}

// ── Payloads ─────────────────────────────────────────────────────────────────

/** Painel do colaborador: pendências + as mais urgentes em lista. */
export interface PainelColaborador {
  periodo: { inicio: string; fim: string };
  rescisoes: PainelRescisoes | null;
  ferias: PainelFerias | null;
  esocial: PainelEsocial | null;
  rescisoesUrgentes: PainelRescisaoUrgente[] | null;
  feriasCriticas: PainelFeriasCritica[] | null;
}

/** Painel de gestão: pendências + atividade do mês. */
export interface PainelGestao {
  periodo: { inicio: string; fim: string };
  rescisoes: PainelRescisoes | null;
  ferias: PainelFerias | null;
  esocial: PainelEsocial | null;
  atividade: PainelAtividade | null;
  serie: PainelSeriePonto[] | null;
}
