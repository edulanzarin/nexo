import { apiRoute } from "@/lib/api-route";
import { montarFiltros, parseTurnoverReq } from "@/lib/folha-turnover-query";
import { EMPRESAS_RH, ehEmpresaRh } from "@/lib/rh";

/**
 * Opções dos filtros da Rotatividade do RH: a mesma consulta do DP, com a
 * empresa FORÇADA nas do RH (o escopo da sessão não se aplica, o gate é o
 * módulo). O `empresas` do cliente só restringe dentro do conjunto do RH.
 *
 * O nexo2 não tinha esta rota (o mapa de seções já a previa): a Rotatividade
 * do RH não filtrava por setor, cargo, vínculo nem horário.
 */
export const GET = apiRoute(async (req) => {
  const { f } = parseTurnoverReq(req.nextUrl.searchParams);
  const pedido = f.empresas.filter(ehEmpresaRh);
  return montarFiltros(f, pedido.length > 0 ? pedido : [...EMPRESAS_RH]);
});
