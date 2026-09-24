import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/contabil-prod-comum";
import { montarTempoContabil } from "@/lib/contabil-tempo";

/**
 * Aba Tempo da Produtividade do Contábil: horas dentro do Questor (`tempouso`)
 * por pessoa e por empresa, cruzadas com os lançamentos do mesmo período.
 */
export const GET = apiRoute(async (req) => {
  const f = parseProdFiltros(req.nextUrl.searchParams);
  return montarTempoContabil(f);
});
