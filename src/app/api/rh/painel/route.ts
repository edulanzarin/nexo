import { apiRoute } from "@/lib/api-route";
import { montarPainelRh } from "@/lib/painel-rh";
import type { PainelRh } from "@/lib/painel-rh-tipos";

/**
 * Painel do RH: a home do módulo. Sem filtros — pendências (experiências,
 * denúncias, clima) e o panorama do mês do RH interno da Navecon.
 */
export const GET = apiRoute(async () => {
  return (await montarPainelRh()) satisfies PainelRh;
});
