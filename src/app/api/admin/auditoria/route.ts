import { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { listarTrilha } from "@/lib/admin";
import { getModulo } from "@/lib/modulos";

/** A trilha de auditoria, da mais recente para a mais antiga, cem por página. */
export const GET = apiRoute(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const modulo = q.get("modulo") ?? "";
  const pagina = Math.max(1, Math.floor(Number(q.get("pagina")) || 1));
  return listarTrilha({
    // Módulo que não existe vira "todos", e não uma trilha vazia sem motivo.
    modulo: getModulo(modulo) ? modulo : undefined,
    busca: q.get("busca")?.trim().slice(0, 100) || undefined,
    pagina,
  });
});
