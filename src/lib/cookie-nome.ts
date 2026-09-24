/**
 * Nome do cookie de sessão, isolado num módulo SEM dependências — para o
 * middleware (edge) poder importá-lo sem arrastar `server-only`/pg/next-headers.
 */
export const COOKIE_SESSAO = "navex_sessao";
