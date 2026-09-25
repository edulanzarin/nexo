/**
 * Provento e desconto têm cor própria no Custo de Folha inteiro (série, ranking
 * de rubricas, barra das quebras). Não usam o azul e o verde de entrada e
 * saída do Fiscal: aqui não há nota, e a mesma cor diria outra coisa.
 */
export const COR_CUSTO = {
  proventos: "var(--serie-3)",
  descontos: "var(--serie-2)",
} as const;
