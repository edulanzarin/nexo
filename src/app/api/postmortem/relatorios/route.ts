import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { ehCoordenacao, podeLerSetor, podePreencher, sessaoPM } from "@/lib/postmortem-acesso";
import { criarPostMortem, listarMeus, listarTodos } from "@/lib/postmortem";
import { criticidadeValida, type Criticidade, type StatusPM } from "@/lib/postmortem-tipos";
import { setorValido } from "@/lib/postmortem-setores";

/**
 * Relatórios Post Mortem. Uma rota para as duas leituras, decidida pela `secao`
 * pedida (o mesmo desenho das Obrigações): `geral` devolve o escritório inteiro,
 * um setor devolve os relatórios de quem está pedindo dentro dele.
 *
 * O gate do apiRoute só garante que a sessão tem ALGUMA seção do módulo — o
 * recorte fino é aqui.
 */
export const GET = apiRoute(async (req) => {
  const sessao = await sessaoPM();
  const sp = req.nextUrl.searchParams;
  const secao = sp.get("secao") ?? "";

  if (secao === "geral") {
    if (!ehCoordenacao(sessao)) throw new FilterError("Você não tem acesso à visão geral");
    const setor = sp.get("setor");
    const crit = sp.get("criticidade");
    const grupo = sp.get("grupo");
    const status = sp.get("status");
    return listarTodos({
      setor: setor && setorValido(setor) ? setor : null,
      criticidade: criticidadeValida(crit) ? (crit as Criticidade) : null,
      grupoId: grupo ? Number(grupo) || null : null,
      status: status === "rascunho" || status === "enviado" ? (status as StatusPM) : null,
    });
  }

  if (!setorValido(secao)) throw new FilterError("Setor inválido");
  if (!podeLerSetor(sessao, secao)) throw new FilterError("Você não tem acesso a este setor");
  return listarMeus(sessao.usuario.id, secao);
});

/** Cria um rascunho do próprio usuário no setor pedido (o form abre nele). */
export const POST = apiRoute(async (req) => {
  const sessao = await sessaoPM();
  const corpo: unknown = await req.json().catch(() => ({}));
  const setor =
    corpo && typeof corpo === "object" && typeof (corpo as { setor?: unknown }).setor === "string"
      ? (corpo as { setor: string }).setor
      : "";
  if (!setorValido(setor)) throw new FilterError("Setor inválido");
  if (!podePreencher(sessao, setor)) {
    throw new FilterError("Você não preenche o relatório deste setor");
  }
  const id = await criarPostMortem(sessao.usuario.id, setor);
  return { id };
});
