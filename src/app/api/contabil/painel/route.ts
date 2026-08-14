import { apiRoute } from "@/lib/api-route";
import { montarPainelContabil } from "@/lib/painel-contabil";
import type { PainelContabil } from "@/lib/painel-contabil-tipos";

/**
 * Painel do Contábil: a home do módulo. Sem filtros — contadores do que o time
 * rodou (trilha de auditoria) e a base configurada. Escopo pela sessão.
 */
export const GET = apiRoute(async () => {
  return (await montarPainelContabil()) satisfies PainelContabil;
});
