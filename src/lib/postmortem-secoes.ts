/**
 * As duas seções de Post Mortem que um módulo de setor ganha. Não há módulo
 * "Post Mortem": o relatório mora DENTRO do setor que o preenche.
 *
 * São DUAS, e não uma com filtro, porque a permissão é binária: restringir o
 * que se enxerga numa tela é separar em outra seção e não concedê-la.
 *
 * - `post-mortem`: o analista preenche e acompanha os seus;
 * - `post-mortem-gestao`: o gestor do setor lê todos os relatórios do setor.
 *
 * A seção em si (rótulo, ícone, caminho) é montada em `secoes/postmortem.ts`.
 */
export const SECAO_PM = "post-mortem";
export const SECAO_PM_GESTAO = "post-mortem-gestao";

/** A seção de Post Mortem é autônoma: não lê o Questor, não usa filtro. */
export function ehSecaoPostMortem(secaoId: string | undefined): boolean {
  return secaoId === SECAO_PM || secaoId === SECAO_PM_GESTAO;
}
