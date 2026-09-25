import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessaoOpcional } from "@/lib/sessao";
import {
  dashboardDenuncia,
  detalheDenuncia,
  listarDenuncias,
  mudarStatusDenuncia,
  responderDenuncia,
} from "@/lib/denuncia";
import { ehStatusDenuncia } from "@/lib/denuncia-tipos";

/**
 * Gestão do canal de denúncia (seção `rh/denuncias`). GET sem `id` traz a fila +
 * o mini-dashboard; com `id`, o detalhe (relato + thread). PATCH trata: responder
 * ou mudar status. A tranca é o `apiRoute` (só quem tem a seção).
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  if (id) {
    const d = await detalheDenuncia(Number(id));
    if (!d) throw new FilterError("Denúncia não encontrada");
    return d;
  }
  const [denuncias, dashboard] = await Promise.all([
    listarDenuncias({ status: sp.get("status"), categoria: sp.get("categoria") }),
    dashboardDenuncia(),
  ]);
  return { denuncias, dashboard };
});

export const PATCH = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) throw new FilterError("Denúncia não informada");

  if (body.acao === "responder") {
    const sessao = await getSessaoOpcional();
    const r = await responderDenuncia(id, String(body.corpo ?? ""), sessao?.usuario.nome ?? "RH");
    if (!r.ok) throw new FilterError(r.erro ?? "Falha ao responder");
    return { ok: true };
  }

  if (body.acao === "status") {
    const status = String(body.status ?? "");
    if (!ehStatusDenuncia(status)) throw new FilterError("Status inválido");
    const r = await mudarStatusDenuncia(id, status);
    if (!r.ok) throw new FilterError(r.erro ?? "Falha ao mudar o status");
    return { ok: true };
  }

  throw new FilterError("Ação inválida");
});
