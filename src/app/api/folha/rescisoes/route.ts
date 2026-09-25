import { apiRoute } from "@/lib/api-route";
import { parseRescisoesFiltros, montarRescisoes } from "@/lib/rescisoes";
import type { RescisoesResumo } from "@/lib/rescisoes-tipos";

/**
 * Fila de rescisões a pagar. Empresa OPCIONAL (retrato do escritório) — o escopo
 * da sessão recorta. A referência do prazo é o fim do período do filtro.
 */
export const GET = apiRoute(async (req) => {
  const f = parseRescisoesFiltros(req.nextUrl.searchParams);
  return (await montarRescisoes(f, f.fim)) satisfies RescisoesResumo;
});
