import { apiRoute } from "@/lib/api-route";
import { montarPessoas, parseTurnoverReq } from "@/lib/folha-turnover-query";
import { EMPRESAS_RH, ehEmpresaRh } from "@/lib/rh";

/** Drill de quebra do RH — empresas forçadas nas do RH (NAVECON/FOUR/FINAVE). */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const { f, sel } = parseTurnoverReq(sp);
  const pedido = f.empresas.filter(ehEmpresaRh);
  const empresas = pedido.length > 0 ? pedido : [...EMPRESAS_RH];
  return montarPessoas(f, sel, sp.get("dim") ?? "", sp.get("valor") ?? "", empresas);
});
