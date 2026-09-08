import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/contabil-prod-comum";
import { montarFechamentoContabil } from "@/lib/contabil-fechamento";

/**
 * Aba Fechamento da Produtividade do Contábil: quais empresas tiveram a
 * competência apurada, de quem elas são e quem apurou.
 *
 * Cruza as duas fontes do sistema — o lançamento de encerramento vem do Questor,
 * o analista responsável vem da carteira do Acessórias, que a rota irmã
 * sincroniza.
 */
export const GET = apiRoute(async (req) => {
  const f = parseProdFiltros(req.nextUrl.searchParams);
  return montarFechamentoContabil(f);
});
