import { apiRoute } from "@/lib/api-route";
import { montarPainelGestao } from "@/lib/painel-dp";
import type { PainelGestao } from "@/lib/painel-dp-tipos";

/**
 * Painel de GESTÃO: a home do gestor. Pendências + a atividade do DP no mês
 * (produtividade, ranking, série). Endpoint próprio, seção `painel-gestao` — o
 * colaborador não tem acesso a esta rota.
 */
export const GET = apiRoute(async () => {
  return (await montarPainelGestao()) satisfies PainelGestao;
});
