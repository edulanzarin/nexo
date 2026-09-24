/** Marca exibida na interface (login, início, títulos, telas públicas). */
export const MARCA = "NaveX";

export function tituloPagina(parte?: string): string {
  return parte ? `${parte} · ${MARCA}` : MARCA;
}

/** Cabeçalho das telas públicas do RH (formulário, denúncia, clima). */
export function marcaPublicaRh(): string {
  return `${MARCA} · RH`;
}
