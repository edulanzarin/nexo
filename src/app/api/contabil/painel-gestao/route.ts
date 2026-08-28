import { apiRoute } from "@/lib/api-route";
import { montarPainelContabilGestao } from "@/lib/painel-contabil";
import type { PainelContabilGestao } from "@/lib/painel-contabil-tipos";

/**
 * Painel de GESTÃO: a home do gestor. Atividade do time no mês, base, série de
 * 6 meses e o feed com nome de quem fez. Endpoint próprio, seção
 * `painel-gestao` — o colaborador não tem acesso a esta rota.
 */
export const GET = apiRoute(async () => {
  return (await montarPainelContabilGestao()) satisfies PainelContabilGestao;
});
