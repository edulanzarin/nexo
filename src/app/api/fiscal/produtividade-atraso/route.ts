import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/prod-comum";
import { montarAtrasoFiscal } from "@/lib/fiscal-atraso";

/** Aba Atraso: distância entre a data do documento e a da escrituração. */
export const GET = apiRoute(async (req) =>
  montarAtrasoFiscal(parseProdFiltros(req.nextUrl.searchParams))
);
