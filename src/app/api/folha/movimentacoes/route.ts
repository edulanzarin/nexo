import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { montarMovimentacoes, parseTurnoverReq } from "@/lib/folha-turnover-query";

/** Admitidos/desligados (ou efetivo) no período — cada linha abre a ficha. */
export const GET = apiRoute(async (req) => {
  const { f, sel } = parseTurnoverReq(req.nextUrl.searchParams);
  if (f.empresas.length === 0) throw new FilterError("Selecione a empresa");
  const efetivo = req.nextUrl.searchParams.get("escopo") === "efetivo";
  return montarMovimentacoes(f, sel, efetivo);
});
