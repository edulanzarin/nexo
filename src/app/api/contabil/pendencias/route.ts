import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { montarPendencias } from "@/lib/pendencias";
import type { PendenciasResp } from "@/lib/types";

/**
 * Central de Pendências: junta os achados da Conferência (notas) e da Auditoria
 * (lançamentos) numa fila, com o estado de triagem. Uma empresa por vez — as
 * varreduras de origem são por empresa+período. Nada é escrito no Questor.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para a Central de Pendências");
  }
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    return (await montarPendencias(
      client,
      empresa,
      f.inicio,
      f.fim,
      f.estabs
    )) satisfies PendenciasResp;
  } finally {
    client.release();
  }
});
