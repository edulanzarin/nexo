import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/prod-comum";
import { montarProdutividadeFiscal } from "@/lib/fiscal-produtividade";

/** Aba Lançamentos: o que o time escriturou no período, por pessoa e espécie. */
export const GET = apiRoute(async (req) =>
  montarProdutividadeFiscal(parseProdFiltros(req.nextUrl.searchParams))
);
