import { apiRoute } from "@/lib/api-route";
import { criarAcesso, listaDoCofre } from "@/lib/ti-acessos";
import { lerPedidoAcesso } from "@/lib/ti-acessos-regras";
import { conferido } from "@/lib/ti-equipamentos";

/**
 * O cofre inteiro, sem nenhum segredo: quais existem e quando foram trocados.
 * Poucas centenas de linhas; a tela recorta por tipo, grupo e busca.
 */
export const GET = apiRoute(async () => listaDoCofre());

export const POST = apiRoute(async (req) => {
  const corpo = await req.json().catch(() => null);
  const { dados, segredos } = conferido(() => lerPedidoAcesso(corpo));
  return { id: await criarAcesso(dados, segredos) };
});
