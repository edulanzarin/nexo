import { apiRoute } from "@/lib/api-route";
import { conferido, criarExterno, listarExternos } from "@/lib/ti-equipamentos";
import { lerDadosExterno } from "@/lib/ti-regras";

/**
 * Quem recebe equipamento e não está no Diretório do RH: o terceirizado, o
 * estagiário que ainda não está na folha. Cadastro da TI, pequeno: vem inteiro.
 */
export const GET = apiRoute(async () => listarExternos());

/** Cadastra e devolve a pessoa, para a tela já escolhê-la na entrega. */
export const POST = apiRoute(async (req) => {
  const corpo = await req.json().catch(() => null);
  return criarExterno(conferido(() => lerDadosExterno(corpo)));
});
