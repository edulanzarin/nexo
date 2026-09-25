import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import {
  atualizarFormularioMeta,
  carregarFormulario,
  criarFormulario,
  duplicarFormulario,
  excluirFormulario,
  listarFormularios,
  salvarCampos,
  type CampoEntrada,
} from "@/lib/formularios";
import type { StatusFormulario } from "@/lib/formularios-tipos";

/** Formulários do RH. `?id=` traz um com seus campos; sem id, a lista. */
export const GET = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (Number.isInteger(id) && id > 0) {
    const f = await carregarFormulario(id);
    if (!f) throw new FilterError("Formulário não encontrado");
    return f;
  }
  return listarFormularios();
});

/** POST cria (body {nome, descricao}) ou duplica (body {duplicarDe: id}). */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  if (body.duplicarDe != null) {
    const id = Number(body.duplicarDe);
    if (!Number.isInteger(id)) throw new FilterError("ID inválido");
    return duplicarFormulario(id);
  }
  return criarFormulario(String(body.nome ?? ""), body.descricao as string | null | undefined);
});

/** PATCH atualiza meta (nome/descrição/status) e/ou os campos, num só pedido. */
export const PATCH = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new FilterError("ID inválido");

  const meta: { nome?: string; descricao?: string | null; status?: StatusFormulario } = {};
  if (typeof body.nome === "string") meta.nome = body.nome;
  if ("descricao" in body) meta.descricao = (body.descricao as string | null) ?? null;
  if (typeof body.status === "string") meta.status = body.status as StatusFormulario;
  if (Object.keys(meta).length) await atualizarFormularioMeta(id, meta);

  if (Array.isArray(body.campos)) {
    await salvarCampos(id, body.campos as CampoEntrada[]);
  }

  const f = await carregarFormulario(id);
  if (!f) throw new FilterError("Formulário não encontrado");
  return f;
});

/** DELETE remove o formulário (e seus campos, por cascade). */
export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) throw new FilterError("ID inválido");
  await excluirFormulario(id);
  return { ok: true };
});
