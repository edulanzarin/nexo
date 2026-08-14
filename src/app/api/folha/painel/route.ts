import { apiRoute } from "@/lib/api-route";
import { montarPainelDp } from "@/lib/painel-dp";
import type { PainelDp } from "@/lib/painel-dp-tipos";

/**
 * Painel do DP: a home do módulo. Sem filtros — carrega o retrato do escritório
 * (escopo pela sessão). Cada bloco é independente; um erro num deles não derruba
 * os outros (ver montarPainelDp).
 */
export const GET = apiRoute(async () => {
  return (await montarPainelDp()) satisfies PainelDp;
});
