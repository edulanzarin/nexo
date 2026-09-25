import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { listarFormularios } from "@/lib/formularios";
import { MARCOS, type Marco } from "@/lib/rh-experiencia";
import { listarConfigExperiencia, salvarConfigMarco } from "@/lib/rh-experiencia-dados";

/**
 * Config da experiência: qual formulário (ativo) sai em cada marco e a
 * antecedência do aviso. Retorna também os formulários ativos para escolher.
 */
export const GET = apiRoute(async () => {
  const [config, formularios] = await Promise.all([listarConfigExperiencia(), listarFormularios()]);
  return { config, formularios: formularios.filter((f) => f.status === "ativo") };
});

/** PUT liga/desliga um formulário a um marco. body {marco, formularioId|null, diasAntes}. */
export const PUT = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const marco = Number(body.marco) as Marco;
  if (!(MARCOS as readonly number[]).includes(marco)) throw new FilterError("Marco inválido");

  const formularioId =
    body.formularioId == null ? null : Number(body.formularioId);
  if (formularioId != null && !Number.isInteger(formularioId)) {
    throw new FilterError("Formulário inválido");
  }
  const diasAntes = Number(body.diasAntes ?? 7);
  if (!Number.isFinite(diasAntes) || diasAntes < 0 || diasAntes > 60) {
    throw new FilterError("Antecedência deve estar entre 0 e 60 dias");
  }

  await salvarConfigMarco(marco, formularioId, diasAntes);
  return { ok: true };
});
