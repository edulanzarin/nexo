import { apiRoute } from "@/lib/api-route";
import { montarPainelColaborador } from "@/lib/painel-dp";
import type { PainelColaborador } from "@/lib/painel-dp-tipos";

/**
 * Painel do COLABORADOR: a home de quem não é gestor. Só pendências (a fila de
 * trabalho) — sem produtividade nem ranking. Endpoint próprio, seção `painel`.
 */
export const GET = apiRoute(async () => {
  return (await montarPainelColaborador()) satisfies PainelColaborador;
});
