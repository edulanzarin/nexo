import { apiRoute } from "@/lib/api-route";
import { carregarPerfil } from "@/lib/perfil";
import { getSessao } from "@/lib/sessao";

/**
 * O perfil de quem está logado. Fora dos módulos: o `apiRoute` só exige a
 * sessão, e o alvo de toda rota daqui é a própria pessoa.
 */
export const GET = apiRoute(async () => carregarPerfil(await getSessao()));
