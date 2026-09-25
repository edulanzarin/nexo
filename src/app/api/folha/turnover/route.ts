import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { montarTurnover, parseTurnoverReq } from "@/lib/folha-turnover-query";

/**
 * Rotatividade de pessoal por empresa. A consulta-mãe (base + agregações) mora
 * em `montarTurnover` (compartilhada com o RH). Aqui só o parse + gate por
 * seção; o escopo de empresa vem da sessão (construirBase).
 */
export const GET = apiRoute(async (req) => {
  const { f, sel } = parseTurnoverReq(req.nextUrl.searchParams);
  if (f.empresas.length === 0) {
    throw new FilterError("Selecione a empresa para calcular a rotatividade");
  }
  return montarTurnover(f, sel);
});
