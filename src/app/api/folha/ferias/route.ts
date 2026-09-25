import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { montarControleFerias } from "@/lib/controle-ferias";
import type { ControleFeriasResp } from "@/lib/types";

/**
 * Controle de férias: quem tem férias vencidas (dobro) ou a vencer, na data de
 * referência (o fim do período do filtro). Uma empresa por vez; escopo travado.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para o controle de férias");
  }
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    return (await montarControleFerias(client, empresa, f.fim)) satisfies ControleFeriasResp;
  } finally {
    client.release();
  }
});
