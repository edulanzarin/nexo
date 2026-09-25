import { apiRoute } from "@/lib/api-route";
import { carregarCargo, excluirCargo, lerDadosCargo, salvarCargo } from "@/lib/admin";
import { idNumericoDaRota } from "@/lib/admin-sessao";
import { FilterError } from "@/lib/fiscal-filters";

/** O cargo aberto, com as seções e os grupos que ele libera. */
export const GET = apiRoute(async (_req, ctx) => {
  const cargo = await carregarCargo(await idNumericoDaRota(ctx, "Cargo inválido"));
  if (!cargo) throw new FilterError("O cargo não existe mais. Alguém pode ter removido.");
  return cargo;
});

export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idNumericoDaRota(ctx, "Cargo inválido");
  return { id: await salvarCargo(lerDadosCargo(await req.json().catch(() => null)), id) };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirCargo(await idNumericoDaRota(ctx, "Cargo inválido"));
  return { ok: true };
});
