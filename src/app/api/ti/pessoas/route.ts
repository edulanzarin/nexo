import { apiRoute } from "@/lib/api-route";
import { pessoasTi } from "@/lib/ti-equipamentos";

/**
 * Quem pode receber equipamento: o Diretório do RH de hoje, com nome, setor e
 * cargo. Rota da TI, e não a do RH, para quem cuida do inventário não precisar
 * (nem ganhar) acesso à ficha das pessoas.
 */
export const GET = apiRoute(async () => pessoasTi());
