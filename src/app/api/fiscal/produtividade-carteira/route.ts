import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/prod-comum";
import { montarCarteiraFiscal } from "@/lib/fiscal-carteira";

/** Aba Carteira: cobertura das empresas no período e tempo parado de cada uma. */
export const GET = apiRoute(async (req) =>
  montarCarteiraFiscal(parseProdFiltros(req.nextUrl.searchParams))
);
