import { apiRoute } from "@/lib/api-route";
import { conferido, criarEquipamento, listarEquipamentos } from "@/lib/ti-equipamentos";
import { lerDadosEquipamento, lerInicio } from "@/lib/ti-regras";

/**
 * O inventário inteiro, cada equipamento com quem está. Algumas centenas de
 * linhas: a tela recebe tudo e recorta por tipo, situação e busca sem voltar
 * aqui.
 */
export const GET = apiRoute(async () => listarEquipamentos());

/** Cadastra o equipamento e onde ele está no dia do cadastro (`inicio`). */
export const POST = apiRoute(async (req) => {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const dados = conferido(() => lerDadosEquipamento(corpo));
  const inicio = conferido(() => lerInicio(corpo?.inicio));
  return { id: await criarEquipamento(dados, inicio) };
});
