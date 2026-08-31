import { apiRoute } from "@/lib/api-route";
import { FilterError, montarQuebraDp, parseDpFiltros } from "@/lib/dp-produtividade";
import { DP_TIPOS, type DpTipo } from "@/lib/dp-tipos";

const TIPOS = new Set<string>(DP_TIPOS.map((t) => t.id));

/**
 * Recorte de UM trabalho do DP no período: quebra por empresa + evolução no
 * tempo. Alimenta a aba do tipo (a quebra por colaborador sai do ranking, já
 * carregado). Respeita o escopo de empresa e o usuário selecionado. Tipos
 * válidos saem do catálogo, não de uma lista repetida na rota.
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? "";
  if (!TIPOS.has(tipo)) {
    throw new FilterError(`Tipo inválido: use ${[...TIPOS].join(", ")}`);
  }
  const f = parseDpFiltros(sp);
  return montarQuebraDp(f, tipo as DpTipo);
});
