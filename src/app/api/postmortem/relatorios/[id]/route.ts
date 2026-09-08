import type { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { ehCoordenacao, sessaoPM } from "@/lib/postmortem-acesso";
import { coerceDados } from "@/lib/postmortem-tipos";
import { excluirPostMortem, obterPostMortem, salvarPostMortem } from "@/lib/postmortem";

// A rota é /api/postmortem/relatorios/<id> — o id é o último segmento.
function idDaRota(req: NextRequest): number {
  const seg = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  const n = Number(seg);
  if (!Number.isInteger(n)) throw new FilterError("Id inválido");
  return n;
}

/** Lê um relatório. Dono sempre; alheio só para quem tem a Geral. */
export const GET = apiRoute(async (req) => {
  const sessao = await sessaoPM();
  const rel = await obterPostMortem(idDaRota(req));
  // Não revela existência para quem não pode ver: some como "não encontrado".
  if (!rel || (rel.autorId !== sessao.usuario.id && !ehCoordenacao(sessao))) {
    throw new FilterError("Relatório não encontrado");
  }
  return rel;
});

/** Salva o rascunho (só o dono, só enquanto rascunho). */
export const PATCH = apiRoute(async (req) => {
  const sessao = await sessaoPM();
  await salvarPostMortem(idDaRota(req), sessao.usuario.id, coerceDados(await req.json()));
  return { ok: true };
});

/** Exclui um rascunho do próprio autor. */
export const DELETE = apiRoute(async (req) => {
  const sessao = await sessaoPM();
  await excluirPostMortem(idDaRota(req), sessao.usuario.id);
  return { ok: true };
});
