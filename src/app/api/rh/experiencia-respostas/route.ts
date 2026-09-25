import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { carregarRespostaExperiencia } from "@/lib/rh-experiencia-dados";

/** Respostas de uma avaliação de experiência (por id), para a RH abrir e ler. */
export const GET = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) throw new FilterError("ID inválido");
  const r = await carregarRespostaExperiencia(id);
  if (!r) throw new FilterError("Resposta não encontrada");
  return r;
});
