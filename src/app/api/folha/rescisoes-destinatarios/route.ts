import { apiRoute } from "@/lib/api-route";
import {
  listarDestinatarios,
  adicionarDestinatario,
  atualizarDestinatario,
  removerDestinatario,
  FilterError,
} from "@/lib/rescisoes";
import type { RescisaoDestinatario } from "@/lib/rescisoes-tipos";

/** Destinatários dos avisos de rescisão (time do DP): lista e CRUD. */
export const GET = apiRoute(async () => {
  return (await listarDestinatarios()) satisfies RescisaoDestinatario[];
});

export const POST = apiRoute(async (req) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await adicionarDestinatario(String(body.nome ?? ""), String(body.email ?? ""));
  return { ok: true };
});

export const PATCH = apiRoute(async (req) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new FilterError("Destinatário inválido");
  await atualizarDestinatario(id, Boolean(body.ativo));
  return { ok: true };
});

export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) throw new FilterError("Destinatário inválido");
  await removerDestinatario(id);
  return { ok: true };
});
