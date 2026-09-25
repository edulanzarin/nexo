import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { montarFiltros, parseTurnoverReq } from "@/lib/folha-turnover-query";

/**
 * Opções dos filtros da Rotatividade para a empresa selecionada. A consulta
 * mora em `montarFiltros` (compartilhada com o RH); o escopo de empresa vem da
 * sessão.
 */
export const GET = apiRoute(async (req) => {
  const { f } = parseTurnoverReq(req.nextUrl.searchParams);
  if (f.empresas.length === 0) {
    throw new FilterError("Selecione a empresa");
  }
  return montarFiltros(f);
});
