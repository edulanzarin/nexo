import { apiRoute } from "@/lib/api-route";
import { montarResumoDp, parseDpFiltros } from "@/lib/dp-produtividade";

/**
 * Produtividade do DP: ranking por usuário + totais do período (com o anterior
 * para o delta dos KPIs). Escopo de empresa e período vêm da querystring; o gate
 * por seção mora no apiRoute. Empresa é opcional (sem ela, todo o escopo).
 */
export const GET = apiRoute(async (req) => {
  const f = parseDpFiltros(req.nextUrl.searchParams);
  return montarResumoDp(f);
});
