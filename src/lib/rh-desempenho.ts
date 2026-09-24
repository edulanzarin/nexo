/**
 * Vocabulário PURO da avaliação de DESEMPENHO (sem servidor), compartilhado
 * entre a tela e o lado servidor (rh-desempenho-dados).
 *
 * Diferença que governa o resto: desempenho não tem marco nem prazo — é a RH que
 * decide quando avaliar — e a avaliação aceita VÁRIAS respostas. Um mesmo link
 * vai a todos os gestores do setor e cada um responde a sua, identificando-se
 * pelo nome. Enquanto a avaliação não for encerrada, o link segue aceitando.
 */

export const STATUS_DESEMPENHO = ["pendente", "enviado", "respondido", "erro"] as const;
export type StatusDesempenho = (typeof STATUS_DESEMPENHO)[number];

export const STATUS_DESEMPENHO_ROTULO: Record<StatusDesempenho, string> = {
  pendente: "Aguardando disparo",
  enviado: "Aguardando resposta",
  respondido: "Respondido",
  erro: "Falha no envio",
};

/** Escopo da rodada: um punhado de gente escolhida a dedo, ou o escritório todo. */
export type EscopoRodada = "avulso" | "escritorio";

export const ESCOPO_RODADA_ROTULO: Record<EscopoRodada, string> = {
  avulso: "Avulsa",
  escritorio: "Escritório inteiro",
};
