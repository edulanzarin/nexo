/**
 * Marca exibida na interface (login, launcher, títulos, telas públicas).
 * Infra permanece "nexo": docker, banco, pacote npm, chaves de localStorage.
 */

export const MARCA = "Navetech";

/** Bump quando trocar `public/images/logo.png` — força o navegador a buscar de novo. */
const LOGO_VERSAO = "2";
export const LOGO_SRC = `/images/logo.png?v=${LOGO_VERSAO}`;

export function tituloPagina(parte?: string): string {
  return parte ? `${parte} · ${MARCA}` : MARCA;
}

/** Cabeçalho das telas públicas do RH (formulário, denúncia, clima). */
export function marcaPublicaRh(): string {
  return `${MARCA} · RH`;
}
