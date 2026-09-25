import { apiRoute } from "@/lib/api-route";
import { montarMovimentacoes, parseTurnoverReq } from "@/lib/folha-turnover-query";
import { EMPRESAS_RH, ehEmpresaRh } from "@/lib/rh";

/** Movimentações do RH — empresas forçadas nas do RH (NAVECON/FOUR/FINAVE). */
export const GET = apiRoute(async (req) => {
  const { f, sel } = parseTurnoverReq(req.nextUrl.searchParams);
  const pedido = f.empresas.filter(ehEmpresaRh);
  const empresas = pedido.length > 0 ? pedido : [...EMPRESAS_RH];
  const efetivo = req.nextUrl.searchParams.get("escopo") === "efetivo";
  return montarMovimentacoes(f, sel, efetivo, empresas);
});
