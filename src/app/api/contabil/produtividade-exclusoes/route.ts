import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/contabil-prod-comum";
import { montarExclusoesContabil } from "@/lib/contabil-exclusoes";

/**
 * Aba Exclusões da Produtividade do Contábil: o que o time apagou do `lctoctb`
 * no período, lido do `lctoctbexcluido` pela `dataexclusao`. Empresa é opcional
 * (sem ela, o escritório inteiro); o escopo da sessão trava dentro do lib.
 */
export const GET = apiRoute(async (req) => {
  const f = parseProdFiltros(req.nextUrl.searchParams);
  return montarExclusoesContabil(f);
});
