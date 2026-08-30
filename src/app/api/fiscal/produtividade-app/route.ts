import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/prod-comum";
import { montarProdutividadeApp } from "@/lib/prod-app";

/**
 * Aba No Nexo da Produtividade do Fiscal: o uso que o time fez do app no
 * período — varreduras executadas, notas abertas e exportações. Não há gesto
 * fiscal que GRAVE algo aqui (o módulo é somente leitura sobre o Questor), e a
 * tela diz isso em vez de fingir produção.
 */
export const GET = apiRoute(async (req) =>
  montarProdutividadeApp("fiscal", parseProdFiltros(req.nextUrl.searchParams))
);
