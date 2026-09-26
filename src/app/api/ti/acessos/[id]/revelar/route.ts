import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { revelarSegredo } from "@/lib/ti-acessos";
import { lerRevelar } from "@/lib/ti-acessos-regras";
import { conferido } from "@/lib/ti-equipamentos";

/**
 * Abre um segredo, e registra quem abriu. POST e não GET: abrir tem efeito (a
 * linha no registro), e GET ficaria no histórico do navegador e em cache.
 */
export const POST = apiRoute(async (req, ctx) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("Acesso inválido");
  const corpo = await req.json().catch(() => null);
  const { campo, modo } = conferido(() => lerRevelar(corpo));
  return revelarSegredo(id, campo, modo);
});
