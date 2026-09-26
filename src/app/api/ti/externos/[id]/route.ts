import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { conferido, excluirExterno, salvarExterno } from "@/lib/ti-equipamentos";
import { lerDadosExterno } from "@/lib/ti-regras";

type Ctx = { params: Promise<Record<string, string>> };

async function idDaRota(ctx: Ctx): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("Cadastro inválido");
  return id;
}

/** Corrige o cadastro ou encerra o vínculo (`ativo: false`). */
export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idDaRota(ctx);
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  await salvarExterno(id, conferido(() => lerDadosExterno(corpo)), corpo?.ativo !== false);
  return { id };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirExterno(await idDaRota(ctx));
  return { ok: true };
});
