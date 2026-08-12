import type { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessaoOpcional, podeSecao } from "@/lib/sessao";
import { coerceDados } from "@/lib/folha-postmortem-tipos";
import { excluirPostMortem, obterPostMortem, salvarPostMortem } from "@/lib/folha-postmortem";

// A rota é /api/folha/post-mortem/<id> — o id é o último segmento do caminho.
function idDaRota(req: NextRequest): number {
  const seg = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  const n = Number(seg);
  if (!Number.isInteger(n)) throw new FilterError("Id inválido");
  return n;
}

/** Lê um relatório. Dono sempre; não-dono só com a seção de Gestão. */
export const GET = apiRoute(async (req) => {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");
  const rel = await obterPostMortem(idDaRota(req));
  const gestor = podeSecao(sessao, "folha", "post-mortem-gestao");
  // Não revela existência para quem não pode ver: some como "não encontrado".
  if (!rel || (rel.autorId !== sessao.usuario.id && !gestor)) {
    throw new FilterError("Relatório não encontrado");
  }
  return rel;
});

/** Salva o rascunho (só o dono, só enquanto rascunho). */
export const PATCH = apiRoute(async (req) => {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");
  await salvarPostMortem(idDaRota(req), sessao.usuario.id, coerceDados(await req.json()));
  return { ok: true };
});

/** Exclui um rascunho do próprio autor. */
export const DELETE = apiRoute(async (req) => {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");
  await excluirPostMortem(idDaRota(req), sessao.usuario.id);
  return { ok: true };
});
