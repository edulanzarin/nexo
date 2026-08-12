import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessaoOpcional, podeSecao } from "@/lib/sessao";
import { criarPostMortem, listarMeus, listarTodos } from "@/lib/folha-postmortem";
import { criticidadeValida, type Criticidade, type StatusPM } from "@/lib/folha-postmortem-tipos";

/**
 * Relatórios Post Mortem do DP. O gate do apiRoute já garante que a sessão tem
 * pelo menos uma das seções (post-mortem / post-mortem-gestao). Aqui o recorte
 * de POSSE: gestor vê todos (com filtros); analista vê só os seus.
 */
export const GET = apiRoute(async (req) => {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");

  if (!podeSecao(sessao, "folha", "post-mortem-gestao")) {
    return listarMeus(sessao.usuario.id);
  }

  const sp = req.nextUrl.searchParams;
  const crit = sp.get("criticidade");
  const grupo = sp.get("grupo");
  const status = sp.get("status");
  return listarTodos({
    criticidade: criticidadeValida(crit) ? (crit as Criticidade) : null,
    grupoId: grupo ? Number(grupo) || null : null,
    status: status === "rascunho" || status === "enviado" ? (status as StatusPM) : null,
  });
});

/** Cria um rascunho do próprio usuário e devolve o id (o form abre nele). */
export const POST = apiRoute(async () => {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");
  const id = await criarPostMortem(sessao.usuario.id);
  return { id };
});
