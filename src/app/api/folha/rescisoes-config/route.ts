import { apiRoute } from "@/lib/api-route";
import { carregarConfigRescisoes, salvarConfigRescisoes, FilterError } from "@/lib/rescisoes";
import type { RescisoesConfig } from "@/lib/rescisoes-tipos";

/** Config do controle de rescisões: prazo de pagamento e antecedência do aviso. */
export const GET = apiRoute(async () => {
  return (await carregarConfigRescisoes()) satisfies RescisoesConfig;
});

export const PUT = apiRoute(async (req) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prazoDias = Number(body.prazoDias);
  const diasAntes = Number(body.diasAntes);
  if (!Number.isInteger(prazoDias) || prazoDias < 1 || prazoDias > 90) {
    throw new FilterError("Prazo deve ser um inteiro entre 1 e 90 dias");
  }
  if (!Number.isInteger(diasAntes) || diasAntes < 0 || diasAntes > 30) {
    throw new FilterError("Antecedência deve ser um inteiro entre 0 e 30 dias");
  }
  await salvarConfigRescisoes(prazoDias, diasAntes);
  return { ok: true };
});
