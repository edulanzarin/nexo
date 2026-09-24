import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/contabil-prod-comum";
import { montarCarteiraContabil } from "@/lib/contabil-carteira";

/**
 * Aba Carteira da Produtividade do Contábil: quais empresas foram atendidas no
 * período, quais estão paradas e há quanto tempo — a cobertura da carteira.
 */
export const GET = apiRoute(async (req) => {
  const f = parseProdFiltros(req.nextUrl.searchParams);
  return montarCarteiraContabil(f);
});
