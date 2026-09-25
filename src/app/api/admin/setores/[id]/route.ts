import { apiRoute } from "@/lib/api-route";
import { excluirSetor, lerNomeSetor, salvarSetor } from "@/lib/admin";
import { idNumericoDaRota } from "@/lib/admin-sessao";

export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idNumericoDaRota(ctx, "Setor inválido");
  return { id: await salvarSetor(lerNomeSetor(await req.json().catch(() => null)), id) };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirSetor(await idNumericoDaRota(ctx, "Setor inválido"));
  return { ok: true };
});
