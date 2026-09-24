import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { coletarBalanceteContabil, resumirBalanceteVerificacao } from "@/lib/balancete-contabil";
import type { BalanceteContabilResp } from "@/lib/types";

/**
 * Balancete de verificação CONTÁBIL (o real, montado dos saldos). Coleta o
 * balancete por empresa e resume por conta: saldo anterior, débito/crédito do
 * período e saldo atual, na árvore do plano — como o Questor monta. Custo zero;
 * roda no botão "Gerar". A Análise usa o mesmo coletor por baixo.
 *
 * O coletor consulta o Questor direto por empresa (sem `buildWhere`), então o
 * escopo de empresa do usuário é travado aqui.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para montar o balancete");
  }
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);

  const client = await pool.connect();
  try {
    const bal = await coletarBalanceteContabil(client, empresa, f.inicio, f.fim, f.estabs);
    if (bal.contas.length === 0) {
      throw new FilterError("Sem movimento contábil no período.");
    }
    return resumirBalanceteVerificacao(bal, f.inicio, f.fim) satisfies BalanceteContabilResp;
  } finally {
    client.release();
  }
});
