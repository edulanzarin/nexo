import { apiRoute } from "@/lib/api-route";
import { carregarGrupoPermissao, excluirGrupoPermissao, salvarGrupoPermissao } from "@/lib/admin";
import { idNumericoDaRota } from "@/lib/admin-sessao";
import { FilterError } from "@/lib/fiscal-filters";
import { lerDadosGrupo } from "@/lib/grupos-empresa";

/** O grupo aberto, com as empresas marcadas como estão gravadas. */
export const GET = apiRoute(async (_req, ctx) => {
  const grupo = await carregarGrupoPermissao(await idNumericoDaRota(ctx, "Grupo inválido"));
  if (!grupo) throw new FilterError("O grupo não existe mais. Alguém pode ter removido.");
  return grupo;
});

export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idNumericoDaRota(ctx, "Grupo inválido");
  return { id: await salvarGrupoPermissao(lerDadosGrupo(await req.json().catch(() => null)), id) };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirGrupoPermissao(await idNumericoDaRota(ctx, "Grupo inválido"));
  return { ok: true };
});
