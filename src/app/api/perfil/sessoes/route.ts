import { apiRoute } from "@/lib/api-route";
import { encerrarOutras } from "@/lib/perfil";
import { getSessao } from "@/lib/sessao";

/** Encerra as sessões abertas em outros dispositivos. Esta continua. */
export const DELETE = apiRoute(async () => ({ encerradas: await encerrarOutras(await getSessao()) }));
