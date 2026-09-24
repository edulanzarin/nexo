/**
 * ESCADA DE IDADE DAS ABAS DE PRODUTIVIDADE (Contábil e Fiscal).
 *
 * Várias abas respondem à mesma pergunta — "quanto tempo isso ficou parado?": o
 * atraso entre o fato e o registro (nos dois módulos), a idade do lançamento que
 * alguém excluiu e o tempo desde o último movimento de uma empresa. Como a grandeza é a mesma, a
 * escada é a mesma: cinco degraus, do verde ao crítico, sempre na mesma ordem.
 * Faixas parecidas com cores diferentes fariam a mesma pergunta parecer duas.
 *
 * A cor é sequencial (verde → âmbar → crítico), não categórica: aqui o degrau é
 * juízo, e a paleta `--esp-*` é para categoria — ver [[Validar paleta de
 * gráficos antes de escolher cores]].
 */
export const ESCADA: string[] = [
  "var(--sai)",
  "color-mix(in oklab, var(--sai) 45%, var(--warning))",
  "var(--warning)",
  "color-mix(in oklab, var(--warning) 40%, var(--critical))",
  "var(--critical)",
];

/** Um degrau da escada: rótulo, cor e o piso (em dias) a partir do qual vale. */
export interface Faixa {
  id: string;
  rotulo: string;
  /** Menor valor, em dias, que cai nesta faixa. */
  desde: number;
  cor: string;
}

/**
 * Faixas fechadas embaixo e abertas em cima: `desde` do degrau seguinte é o
 * primeiro valor que já NÃO pertence a este. Ver [[Invertida a fórmula, o
 * arredondamento é meia-aberto…]].
 */
export function montarFaixas(degraus: { id: string; rotulo: string; desde: number }[]): Faixa[] {
  return degraus.map((d, i) => ({ ...d, cor: ESCADA[Math.min(i, ESCADA.length - 1)] }));
}

/** Índice da faixa em que `dias` cai. Valor abaixo do primeiro piso cai na 0. */
export function faixaDe(faixas: Faixa[], dias: number): number {
  let i = 0;
  for (let k = 0; k < faixas.length; k++) if (dias >= faixas[k].desde) i = k;
  return i;
}

/** Zera um vetor de contagem com o mesmo tamanho da escada de faixas. */
export const zeroFaixas = (faixas: Faixa[]): number[] => faixas.map(() => 0);
