import { apiRoute } from "@/lib/api-route";
import { lerDadosCargo, listarCargos, salvarCargo } from "@/lib/admin";

/** Os cargos, com quantas seções, grupos e pessoas cada um tem. */
export const GET = apiRoute(async () => listarCargos());

export const POST = apiRoute(async (req) => ({
  id: await salvarCargo(lerDadosCargo(await req.json().catch(() => null))),
}));
