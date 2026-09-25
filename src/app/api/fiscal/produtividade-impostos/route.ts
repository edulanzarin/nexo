import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/prod-comum";
import { montarImpostosFiscal } from "@/lib/fiscal-impostos";

/** Aba Impostos: quanto de tributo passou pelas mãos de cada pessoa. */
export const GET = apiRoute(async (req) =>
  montarImpostosFiscal(parseProdFiltros(req.nextUrl.searchParams))
);
