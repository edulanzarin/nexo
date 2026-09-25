import { apiRoute } from "@/lib/api-route";
import { estadoVarredura, pedirParadaVarredura } from "@/lib/obrigacoes";
import type { EstadoVarredura } from "@/lib/obrigacoes";

/** Estado ao vivo da varredura — progresso, falhas e estimativa de fim. */
export const GET = apiRoute(async () => (await estadoVarredura()) satisfies EstadoVarredura);

/**
 * Pedido de PARADA. Não mata o processo: marca a flag que a varredura relê a
 * cada empresa, e ela encerra no fim do ciclo corrente com a linha fechada e o
 * progresso preservado — que é o que permite retomar depois de onde parou.
 */
export const DELETE = apiRoute(async () => ({ parada: await pedirParadaVarredura() }));
