import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { sessaoPM } from "@/lib/postmortem-acesso";
import { coerceDados } from "@/lib/postmortem-tipos";
import { enviarPostMortem } from "@/lib/postmortem";

/**
 * Envia o relatório: grava o corpo, cobra os campos essenciais, aloca o nº
 * sequencial e fecha. Só o dono, só a partir de rascunho. Devolve o número.
 */
export const POST = apiRoute(async (req, ctx) => {
  const sessao = await sessaoPM();
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) throw new FilterError("Id inválido");
  const numero = await enviarPostMortem(n, sessao.usuario.id, coerceDados(await req.json()));
  return { numero };
});
