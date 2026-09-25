import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { montarPessoas, parseTurnoverReq } from "@/lib/folha-turnover-query";

/** Drill de uma quebra: as pessoas de um grupo (dim/valor) no período. */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const { f, sel } = parseTurnoverReq(sp);
  if (f.empresas.length === 0) throw new FilterError("Selecione a empresa");
  return montarPessoas(f, sel, sp.get("dim") ?? "", sp.get("valor") ?? "");
});
