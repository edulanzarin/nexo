/**
 * Tipos do Painel do RH — a home do módulo interno da Navecon. Junta as
 * PENDÊNCIAS que cobram ação (experiências a decidir, denúncias abertas, clima)
 * e um PANORAMA do mês (o que fluiu). Tudo no banco do app (experiência,
 * denúncia, clima, envios são do RH interno, não do Questor). Cada bloco é
 * independente e opcional (`| null`).
 */

/** O que cobra ação agora. */
export interface RhPendencias {
  experienciasPendentes: number; // avaliações não respondidas (a decidir)
  experienciasAtrasadas: number; // passaram do marco sem resposta
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
  pendencias: RhPendencias | null;
  panorama: RhPanorama | null;
}
