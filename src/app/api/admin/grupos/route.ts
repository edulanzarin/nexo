import { apiRoute } from "@/lib/api-route";
import { listarGruposPermissao, salvarGrupoPermissao } from "@/lib/admin";
import { lerDadosGrupo } from "@/lib/grupos-empresa";

/** Os grupos de permissão, com quantas empresas, cargos e pessoas cada um alcança. */
export const GET = apiRoute(async () => listarGruposPermissao());

export const POST = apiRoute(async (req) => ({
  id: await salvarGrupoPermissao(lerDadosGrupo(await req.json().catch(() => null))),
}));
