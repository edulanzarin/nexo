import { apiRoute } from "@/lib/api-route";
import { conferido, listarMovimentacoes, movimentar } from "@/lib/ti-equipamentos";
import { lerPedido } from "@/lib/ti-regras";

/** O registro de todas as movimentações, a mais recente primeiro, cada uma com o "de" e o "para". */
export const GET = apiRoute(async () => listarMovimentacoes());

/** Entrega, devolução, manutenção ou baixa de um ou mais equipamentos: todos ou nenhum. */
export const POST = apiRoute(async (req) => {
  const corpo = await req.json().catch(() => null);
  return movimentar(conferido(() => lerPedido(corpo)));
});
