import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import {
  carregarGrupoEmpresa,
  excluirGrupoEmpresa,
  lerDadosGrupo,
  salvarGrupoEmpresa,
} from "@/lib/grupos-empresa";

type Ctx = { params: Promise<Record<string, string>> };

async function idDaRota(ctx: Ctx): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("Grupo inválido");
  return id;
}

/** O grupo aberto, com as empresas marcadas como estão gravadas. */
export const GET = apiRoute(async (_req, ctx) => {
  const grupo = await carregarGrupoEmpresa(await idDaRota(ctx));
  if (!grupo) throw new FilterError("O grupo não existe mais. Alguém pode ter removido.");
  return grupo;
});

export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idDaRota(ctx);
  await salvarGrupoEmpresa({ id, ...lerDadosGrupo(await req.json().catch(() => null)) });
  return { id };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirGrupoEmpresa(await idDaRota(ctx));
  return { ok: true };
});
