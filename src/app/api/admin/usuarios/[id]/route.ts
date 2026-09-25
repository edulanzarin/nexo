import { apiRoute } from "@/lib/api-route";
import { excluirUsuario, lerDadosUsuario, salvarUsuario } from "@/lib/admin";
import { idUsuarioDaRota, quemAdministra } from "@/lib/admin-sessao";

export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idUsuarioDaRota(ctx);
  const dados = lerDadosUsuario(await req.json().catch(() => null), false);
  return { id: await salvarUsuario(dados, await quemAdministra(), id) };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirUsuario(await idUsuarioDaRota(ctx), (await quemAdministra()).id);
  return { ok: true };
});
