/**
 * CLIMA (avaliação anônima da empresa) — parte PURA (sem servidor). Enums e DTOs
 * compartilhados entre o formulário público (client), a gestão (client) e o
 * serviço (server).
 *
 * A rodada de clima usa um FORMULÁRIO do construtor: as perguntas são os campos
 * daquele formulário e a resposta guarda os `valores` deles — anônima, sem
 * nenhum vínculo com pessoa. Por isso os tipos aqui reaproveitam os do builder.
 */

import type { FormularioCampo, RespostaValores } from "./formularios-tipos";

export type StatusRodada = "aberta" | "fechada";

/** O que o funcionário vê no link público /clima/<slug>: o formulário da rodada. */
export interface RodadaPublica {
  slug: string;
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
}

/** Envio anônimo: só os valores dos campos do formulário. */
export interface RespostaClimaInput {
  valores: RespostaValores;
}

// ── Gestão ───────────────────────────────────────────────────────────────────

export interface RodadaResumo {
  id: number;
  titulo: string;
  slug: string;
  status: StatusRodada;
  respostas: number;
  abertoEm: string;
  fechadoEm: string | null;
}

/** Uma resposta anônima já registrada (para a lista no painel). */
export interface RespostaClima {
  valores: RespostaValores;
  criadoEm: string;
}

export interface ClimaDashboard {
  rodada: { id: number; titulo: string; slug: string; status: StatusRodada };
  /** Campos do formulário da rodada (para renderizar cada resposta). */
  campos: FormularioCampo[];
  total: number;
  /** Respostas anônimas, mais recentes primeiro. */
  respostas: RespostaClima[];
}
