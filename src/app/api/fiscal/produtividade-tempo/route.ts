import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/prod-comum";
import { montarTempoFiscal } from "@/lib/fiscal-tempo";

/** Aba Tempo: horas no Questor por pessoa e por empresa do time fiscal. */
export const GET = apiRoute(async (req) =>
  montarTempoFiscal(parseProdFiltros(req.nextUrl.searchParams))
);
