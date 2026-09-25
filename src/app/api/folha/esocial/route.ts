import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { montarConformidadeEsocial } from "@/lib/conformidade-esocial";
import type { ConformidadeEsocialResp } from "@/lib/types";

/**
 * Conformidade eSocial: panorama dos eventos transmitidos no período (por tipo e
 * situação) + as pendências obrigatórias (admissão sem S-2200 aceito, rescisão
 * sem S-2299 aceito). Uma empresa por vez; escopo travado aqui.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para a conformidade eSocial");
  }
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    return (await montarConformidadeEsocial(client, empresa, f.inicio, f.fim)) satisfies ConformidadeEsocialResp;
  } finally {
    client.release();
  }
});
