import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { coletarBalanceteContabil } from "@/lib/balancete-contabil";
import { analisarMotor } from "@/lib/analise-motor";
import { redigirLaudo, AnaliseError } from "@/lib/analise-balancete";
import { registrarAuditoria } from "@/lib/auditoria";
import type { LaudoEscritoResp } from "@/lib/types";

/**
 * Laudo ESCRITO por IA — rota opcional (botão "Gerar laudo escrito"). Recalcula
 * o motor (barato) e manda os achados pra IA redigir a prosa. É o único ponto
 * que gasta API. Mesmo gate de escopo da rota principal.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para o laudo");
  }
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    const bal = await coletarBalanceteContabil(client, empresa, f.inicio, f.fim, f.estabs);
    if (bal.contas.length === 0) {
      throw new FilterError("Sem movimento contábil no período para analisar.");
    }
    const analise = analisarMotor(bal);
    try {
      const { texto, meta } = await redigirLaudo(bal, analise);
      await registrarAuditoria({
        acao: "contabil.laudo.gerar",
        alvo: `${bal.empresa.nome} · ${f.inicio} a ${f.fim}`,
        codigoempresa: empresa,
      });
      return { texto, meta } satisfies LaudoEscritoResp;
    } catch (err) {
      if (err instanceof AnaliseError) throw new FilterError(err.message);
      throw err;
    }
  } finally {
    client.release();
  }
});
