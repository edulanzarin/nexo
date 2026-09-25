import { apiRoute } from "@/lib/api-route";
import { lerDadosGrupo, listarGruposCadastro, salvarGrupoEmpresa } from "@/lib/grupos-empresa";

/**
 * O cadastro de grupos de empresa de negócio. A lista é a de todos os grupos,
 * sem o recorte de escopo que `/api/grupos-empresa` aplica: quem administra o
 * cadastro precisa ver o grupo inteiro, e a contagem é contra o Questor todo.
 */
export const GET = apiRoute(async () => listarGruposCadastro());

export const POST = apiRoute(async (req) => {
  const id = await salvarGrupoEmpresa(lerDadosGrupo(await req.json().catch(() => null)));
  return { id };
});
