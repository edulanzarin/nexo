import { apiRoute } from "@/lib/api-route";
import { empresasMarcaveis } from "@/lib/grupos-empresa";

/**
 * O universo de um grupo de permissão: todas as empresas do Questor, sem o
 * recorte de escopo de quem administra. Um "todas, exceto" se resolve contra
 * este universo.
 */
export const GET = apiRoute(async () => empresasMarcaveis());
