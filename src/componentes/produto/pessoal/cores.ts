/**
 * A cor de cada movimento de pessoal, igual na série, nas barras e na tabela:
 * admissão é verde e desligamento é vermelho em todo lugar, para a pessoa não
 * reaprender a legenda a cada painel. O turnover é uma razão, não um movimento,
 * então ganha cor de série e não de estado.
 */
export const COR_MOVIMENTO = {
  admissoes: "var(--ok)",
  desligamentos: "var(--perigo)",
  turnover: "var(--serie-4)",
  tempoCasa: "var(--serie-5)",
} as const;
