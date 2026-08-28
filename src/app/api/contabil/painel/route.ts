import { apiRoute } from "@/lib/api-route";
import { montarPainelContabilColaborador } from "@/lib/painel-contabil";
import type { PainelContabilColaborador } from "@/lib/painel-contabil-tipos";

/**
 * Painel do COLABORADOR: a home de quem não é gestor. Os MEUS números do mês
 * (recorte por dono na trilha) + a base configurada — sem série do time nem
 * atividade alheia. Endpoint próprio, seção `painel`.
 */
export const GET = apiRoute(async () => {
  return (await montarPainelContabilColaborador()) satisfies PainelContabilColaborador;
});
