import { apiRoute } from "@/lib/api-route";
import { lerDadosUsuario, listarUsuarios, salvarUsuario } from "@/lib/admin";
import { quemAdministra } from "@/lib/admin-sessao";

/** A lista de usuários, com os cargos e a foto de cada um. */
export const GET = apiRoute(async () => listarUsuarios());

export const POST = apiRoute(async (req) => {
  const dados = lerDadosUsuario(await req.json().catch(() => null), true);
  return { id: await salvarUsuario(dados, await quemAdministra()) };
});
