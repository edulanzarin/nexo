/**
 * Shift+clique numa lista marcável: os itens entre a âncora (o último clicado
 * sem Shift) e o clicado agora, nas duas direções e com as pontas. Sem âncora,
 * ou com a âncora fora da lista (a busca mudou, a visão escondeu), vale só o
 * clicado — pegar um intervalo que a pessoa não está vendo marcaria às cegas.
 */
export function codigosDoIntervalo(lista: readonly number[], ancora: number | null, clicado: number): number[] {
  const de = ancora == null ? -1 : lista.indexOf(ancora);
  const ate = lista.indexOf(clicado);
  if (de < 0 || ate < 0) return [clicado];
  const [ini, fim] = de < ate ? [de, ate] : [ate, de];
  return lista.slice(ini, fim + 1);
}
