import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/contabil-prod-comum";
import { montarAtrasoContabil } from "@/lib/contabil-atraso";

/**
 * Aba Atraso da Produtividade do Contábil: a distância entre a competência do
 * fato (`datalctoctb`) e o carimbo do registro (`datahoralctoctb`), por pessoa,
 * empresa e competência.
 */
export const GET = apiRoute(async (req) => {
  const f = parseProdFiltros(req.nextUrl.searchParams);
  return montarAtrasoContabil(f);
});
