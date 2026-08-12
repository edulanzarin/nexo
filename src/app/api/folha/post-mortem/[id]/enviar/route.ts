import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessaoOpcional } from "@/lib/sessao";
import { coerceDados } from "@/lib/folha-postmortem-tipos";
import { enviarPostMortem } from "@/lib/folha-postmortem";

/**
 * Envia o relatório: grava o corpo, cobra os campos essenciais, aloca o nº
 * sequencial e fecha. Só o dono, só a partir de rascunho. Devolve o número.
 */
export const POST = apiRoute(async (req, ctx) => {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) throw new FilterError("Id inválido");
  const numero = await enviarPostMortem(n, sessao.usuario.id, coerceDados(await req.json()));
  return { numero };
});
