import { apiRoute } from "@/lib/api-route";
import { buscarContrapartes } from "@/lib/contrapartes";

/** Contrapartes com movimento — modal de filtro do explorador. Mesma query do
 * Fiscal, servida pelo módulo Contábil (gate por caminho no apiRoute). */
export const GET = apiRoute((req) => buscarContrapartes(req.nextUrl.searchParams));
