/**
 * Como um grupo de empresa diz quem está nele. Vale para os dois cadastros de
 * grupo (permissão e negócio): o que se guarda são as empresas MARCADAS, e o
 * modo diz o que elas significam.
 *
 * - `lista`: as marcadas são o grupo;
 * - `exceto`: o grupo é todo o universo (as empresas do Questor) menos as
 *   marcadas. Resolvido contra o universo do momento, então empresa nova entra
 *   sem ninguém tocar no grupo.
 *
 * Puro e sem servidor: a tela usa o mesmo cálculo para contar e para trocar de
 * modo, e o servidor para resolver o escopo.
 */

export type ModoGrupo = "lista" | "exceto";

export function ehModoGrupo(v: unknown): v is ModoGrupo {
  return v === "lista" || v === "exceto";
}

/** Empresas que o grupo contém hoje. */
export function membrosDoGrupo(
  modo: ModoGrupo,
  marcadas: Iterable<number>,
  universo: readonly number[]
): number[] {
  if (modo === "lista") return [...new Set(marcadas)];
  const fora = new Set(marcadas);
  return universo.filter((codigo) => !fora.has(codigo));
}

/**
 * Troca o modo sem mudar quem está no grupo: as marcadas viram o complemento
 * dentro do universo. "1.478 marcadas em lista" vira "92 marcadas em exceto" —
 * as mesmas empresas hoje, e as novas passam a entrar.
 */
export function inverterMarcadas(marcadas: ReadonlySet<number>, universo: readonly number[]): Set<number> {
  return new Set(universo.filter((codigo) => !marcadas.has(codigo)));
}
