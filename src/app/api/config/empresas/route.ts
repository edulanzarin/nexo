import { apiRoute } from "@/lib/api-route";
import { empresasMarcaveis } from "@/lib/grupos-empresa";

/**
 * Todas as empresas do Questor, para marcar num grupo. Fora do escopo da
 * sessão de propósito (é o universo do grupo), e por isso só para quem tem a
 * seção de Grupos de Empresa: `/api/empresas` segue sendo a lista de quem
 * consulta.
 */
export const GET = apiRoute(async () => empresasMarcaveis());
