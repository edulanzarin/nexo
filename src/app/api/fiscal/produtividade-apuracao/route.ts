import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/prod-comum";
import { montarApuracaoFiscal } from "@/lib/fiscal-apuracao";

/**
 * Aba Apuração: o fechamento mensal do fiscal — quem apurou qual imposto de qual
 * empresa, em que competência e com quanto atraso. Lê `periodoapuradofis` e
 * `periodoapuradofisretido`; o escopo da sessão trava dentro do lib.
 */
export const GET = apiRoute(async (req) =>
  montarApuracaoFiscal(parseProdFiltros(req.nextUrl.searchParams))
);
