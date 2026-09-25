/**
 * Tipos do Painel do RH, a home do módulo interno da Navecon. Junta o que cobra
 * ação (experiências a decidir, denúncias abertas, avaliações em andamento) e o
 * que fluiu no mês. Cada bloco é independente e opcional (`| null`): o que
 * falhou no servidor vira buraco só naquele pedaço.
 */

import type { Marco, StatusExperiencia } from "./rh-experiencia";

/** Um marco de experiência sem resposta, para a lista dos mais urgentes. */
export interface ExperienciaUrgente {
  codigoempresa: number;
  contrato: number;
  nome: string;
  setor: string | null;
  marco: Marco;
  vencimento: string; // YYYY-MM-DD
  diasParaVencer: number; // negativo = venceu
  status: StatusExperiencia;
  /** Gestores ativos no setor. Zero = o link não sai para ninguém. */
  gestores: number;
}

/**
 * As experiências contadas do mesmo jeito que a tela de Experiência: só
 * contratos em curso, atraso pela data. Bloco próprio porque lê o Questor, e o
 * resto do painel (só banco do app) não deve cair junto se ele falhar.
 */
export interface RhExperiencias {
  aDecidir: number; // marcos sem resposta (a vencer + em atraso)
  atrasadas: number; // passaram do vencimento sem resposta
  semGestor: number; // sem resposta e sem gestor ativo no setor
  urgentes: ExperienciaUrgente[];
}

/** Denúncias e avaliações: o que cobra ação agora, tudo no banco do app. */
export interface RhPendencias {
  denunciasAbertas: number; // recebidas + em análise
  denunciasRecebidas: number; // ainda não abertas (novas)
  climaRodadasAbertas: number;
  climaRespostasAbertas: number; // respostas nas rodadas abertas
}

/** O que fluiu no mês corrente. */
export interface RhPanorama {
  experienciasRespondidas: number;
  denunciasRecebidasMes: number;
  campanhasEnviadas: number;
  respostasClima: number;
}

/** Payload do painel: período de referência + blocos. */
export interface PainelRh {
  periodo: { inicio: string; fim: string };
  experiencias: RhExperiencias | null;
  pendencias: RhPendencias | null;
  panorama: RhPanorama | null;
}
