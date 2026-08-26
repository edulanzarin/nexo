import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { aprenderContabilizacao } from "@/lib/aprender-contabilizacao";
import { aprenderContaEfetiva } from "@/lib/conta-efetiva";

/**
 * Reaprende, dos últimos 12 meses, quais CFOPs da empresa contabilizam e qual
 * conta cada natureza de serviço de fato recebe, e regrava os dois cadastros (os
 * overrides manuais ficam intactos — moram em conf_regra).
 * POST = edição, então exige permissão de edição no módulo.
 */
export const POST = apiRoute(async (req) => {
  const empresa = Number(req.nextUrl.searchParams.get("empresa"));
  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);
  const client = await pool.connect();
  try {
    const cfops = await aprenderContabilizacao(client, empresa);
    const naturezas = await aprenderContaEfetiva(client, empresa);
    return { ok: true, cfops, naturezas };
  } finally {
    client.release();
  }
});
