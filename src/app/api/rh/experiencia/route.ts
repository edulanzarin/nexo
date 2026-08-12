import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { empresasDoFiltro } from "@/lib/rh";
import { excluirExperiencia, montarPainelExperiencia } from "@/lib/rh-experiencia-dados";

/** Painel de experiência: marcos 45/90 dos contratos em curso, com status. */
export const GET = apiRoute(async (req) => {
  const empresas = empresasDoFiltro(req.nextUrl.searchParams.get("empresa"));
  return montarPainelExperiencia(empresas);
});

/** Exclui uma avaliação materializada (?id=) junto com respostas e lembretes. */
export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("ID inválido");
  await excluirExperiencia(id);
  return { ok: true };
});
