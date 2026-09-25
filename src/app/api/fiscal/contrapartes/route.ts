import { apiRoute } from "@/lib/api-route";
import { buscarContrapartes } from "@/lib/contrapartes";

/** Contrapartes com movimento — modal de filtro do explorador. Query
 * compartilhada com o Contábil; esta rota serve o módulo Fiscal. */
export const GET = apiRoute((req) => buscarContrapartes(req.nextUrl.searchParams));
