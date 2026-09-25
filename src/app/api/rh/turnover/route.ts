import { apiRoute } from "@/lib/api-route";
import { montarTurnover, parseTurnoverReq } from "@/lib/folha-turnover-query";
import { EMPRESAS_RH, ehEmpresaRh } from "@/lib/rh";

/**
 * Rotatividade do RH: mesma consulta-mãe da Folha, mas com empresa FORÇADA nas
 * do RH — NAVECON/FOUR/FINAVE (o escopo da sessão não se aplica — o gate é o módulo). O filtro
 * `empresas` do cliente só restringe dentro do conjunto do RH.
 */
export const GET = apiRoute(async (req) => {
  const { f, sel } = parseTurnoverReq(req.nextUrl.searchParams);
  const pedido = f.empresas.filter(ehEmpresaRh);
  const empresas = pedido.length > 0 ? pedido : [...EMPRESAS_RH];
  return montarTurnover(f, sel, empresas);
});
