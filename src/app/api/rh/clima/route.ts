import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { criarRodada, dashboardClima, definirStatusRodada, listarRodadas } from "@/lib/clima";

/**
 * Gestão do clima (seção `rh/clima`). GET sem `id` lista as rodadas; com `id`, o
 * dashboard daquela rodada. POST cria rodada; PATCH abre/fecha. Gate pelo `apiRoute`.
 */
export const GET = apiRoute(async (req) => {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const d = await dashboardClima(Number(id));
    if (!d) throw new FilterError("Rodada não encontrada");
    return d;
  }
  return { rodadas: await listarRodadas() };
});

export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const r = await criarRodada({
    titulo: String(body.titulo ?? ""),
    descricao: body.descricao ? String(body.descricao) : null,
    formularioId: Number(body.formularioId),
  });
  if (!r.ok) throw new FilterError(r.erro ?? "Falha ao criar a rodada");
  return { id: r.id, slug: r.slug };
});

export const PATCH = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const status = String(body.status ?? "");
  if (status !== "aberta" && status !== "fechada") throw new FilterError("Status inválido");
  const r = await definirStatusRodada(id, status);
  if (!r.ok) throw new FilterError(r.erro ?? "Falha ao atualizar a rodada");
  return { ok: true };
});
