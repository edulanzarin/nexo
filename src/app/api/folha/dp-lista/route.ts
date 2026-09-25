import { apiRoute } from "@/lib/api-route";
import { FilterError, montarListaDp, parseDpFiltros } from "@/lib/dp-produtividade";
import { DP_TIPOS, type DpTipo } from "@/lib/dp-tipos";

const TIPOS = new Set<string>(DP_TIPOS.map((t) => t.id));

/**
 * Detalhe de UM trabalho do DP, uma linha por registro no período. Mesma
 * consulta-base; o `tipo` escolhe a tabela e as colunas específicas. Os tipos
 * válidos saem do catálogo `DP_TIPOS` — fonte nova entra lá e a rota aceita
 * sozinha, sem lista repetida aqui.
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? "";
  if (!TIPOS.has(tipo)) {
    throw new FilterError(`Tipo inválido: use ${[...TIPOS].join(", ")}`);
  }
  const f = parseDpFiltros(sp);
  return montarListaDp(f, tipo as DpTipo);
});
