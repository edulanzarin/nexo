import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { carregarAcesso, excluirAcesso, salvarAcesso } from "@/lib/ti-acessos";
import { lerPedidoAcesso } from "@/lib/ti-acessos-regras";
import { conferido } from "@/lib/ti-equipamentos";

type Ctx = { params: Promise<Record<string, string>> };

async function idDoAcesso(ctx: Ctx): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("Acesso inválido");
  return id;
}

/** O acesso aberto, com o registro de quem mexeu. Os segredos continuam fechados. */
export const GET = apiRoute(async (_req, ctx) => {
  const a = await carregarAcesso(await idDoAcesso(ctx));
  if (!a) throw new FilterError("Esse acesso não existe mais. Alguém pode ter apagado.");
  return a;
});

/** Corrige o cadastro. Segredo que não vem no pedido fica como está. */
export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idDoAcesso(ctx);
  const corpo = await req.json().catch(() => null);
  const { dados, segredos } = conferido(() => lerPedidoAcesso(corpo));
  await salvarAcesso(id, dados, segredos);
  return { id };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirAcesso(await idDoAcesso(ctx));
  return { ok: true };
});
