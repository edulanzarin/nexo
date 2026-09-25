import { apiRoute } from "@/lib/api-route";
import { buscarNotasLista } from "@/lib/notas-lista";

/** Listagem bruta de notas (explorador de dados) do Fiscal. A query é
 * compartilhada com o Contábil; aqui a rota só serve o módulo Fiscal. */
export const GET = apiRoute((req) => buscarNotasLista(req.nextUrl.searchParams));
