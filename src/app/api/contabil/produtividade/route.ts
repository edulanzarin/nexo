import { apiRoute } from "@/lib/api-route";
import { montarProdutividadeContabil, parseProdFiltros } from "@/lib/contabil-produtividade";

/**
 * Produtividade do Contábil: uma consulta ao `lctoctb` no grão (usuário,
 * empresa, origem, dia, hora) e todo o rollup da tela — ranking, origens,
 * empresas, série, calendário e horas. Empresa é opcional (sem ela, o retrato
 * do escritório inteiro); o escopo da sessão trava dentro do lib.
 */
export const GET = apiRoute(async (req) => {
  const f = parseProdFiltros(req.nextUrl.searchParams);
  return montarProdutividadeContabil(f);
});
