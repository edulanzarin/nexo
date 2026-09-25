import { apiRoute } from "@/lib/api-route";
import { lerNomeSetor, listarSetores, salvarSetor } from "@/lib/admin";

/** Os setores, com quantos cargos cada um agrupa. */
export const GET = apiRoute(async () => listarSetores());

export const POST = apiRoute(async (req) => ({
  id: await salvarSetor(lerNomeSetor(await req.json().catch(() => null))),
}));
