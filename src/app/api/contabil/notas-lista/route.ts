import { apiRoute } from "@/lib/api-route";
import { buscarNotasLista } from "@/lib/notas-lista";

/** Listagem bruta de notas (explorador) do Contábil. Mesma query do Fiscal,
 * servida pelo módulo Contábil (gate por caminho no apiRoute). */
export const GET = apiRoute((req) => buscarNotasLista(req.nextUrl.searchParams));
