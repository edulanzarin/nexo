import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { montarCustoFolha } from "@/lib/custo-folha";
import type { CustoFolhaResp } from "@/lib/types";

/**
 * Custo de Folha: a remuneração calculada (`calculoevento`) do período, por
 * rubrica, tipo de folha, setor/cargo/estabelecimento e mês. Uma empresa por vez
 * (a varredura é pesada); escopo de empresa travado aqui.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para o custo de folha");
  }
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    return (await montarCustoFolha(client, empresa, f.inicio, f.fim)) satisfies CustoFolhaResp;
  } finally {
    client.release();
  }
});
