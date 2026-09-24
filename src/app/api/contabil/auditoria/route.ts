import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { montarAuditoria } from "@/lib/auditoria-lancamentos";
import type { AuditoriaResp } from "@/lib/types";

/**
 * Auditoria de lançamentos: varre o `lctoctb` do período e acende os lançamentos
 * com anomalia (conta sintética, conta fora do plano, sem histórico, ajuste de
 * período anterior, manual em conta de controle, partida repetida). Escopo de
 * empresa travado aqui; uma empresa por vez (a varredura é por empresa+período).
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para a auditoria");
  }
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    return (await montarAuditoria(client, empresa, f.inicio, f.fim, f.estabs)) satisfies AuditoriaResp;
  } finally {
    client.release();
  }
});
