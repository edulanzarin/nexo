import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { coletarBalanceteContabil } from "@/lib/balancete-contabil";
import { analisarMotor } from "@/lib/analise-motor";
import type { AnaliseBalanceteResp } from "@/lib/types";

/**
 * Análise de Balancete — MOTOR determinístico (sem IA). Coleta os saldos do
 * contábil por empresa e roda as regras, indicadores e evolução. Custo zero;
 * roda no Executar. A prosa por IA é uma rota à parte (./laudo), sob demanda.
 *
 * O coletor consulta o Questor direto por empresa (sem `buildWhere`), então o
 * escopo de empresa do usuário é travado aqui.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para a análise");
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
    return {
      analise,
      empresa: bal.empresa,
      periodo: { inicio: f.inicio, fim: f.fim, meses: bal.mesesLabels },
    } satisfies AnaliseBalanceteResp;
  } finally {
    client.release();
  }
});
