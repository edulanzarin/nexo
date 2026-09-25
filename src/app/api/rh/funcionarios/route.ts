import { apiRoute } from "@/lib/api-route";
import { listarDiretorio } from "@/lib/rh-diretorio";

/**
 * Diretório: todos os colaboradores ATIVOS das empresas do RH — funcionários do
 * Questor (base, com as correções do app-db aplicadas por cima) MAIS as pessoas
 * PJ, que não existem no Questor. Volume é pequeno (~80): a rota devolve a lista
 * inteira e a tela filtra por empresa/setor/origem/busca no cliente. A montagem
 * mora em `listarDiretorio` (compartilhada com a ficha).
 */
export const GET = apiRoute(() => listarDiretorio());
