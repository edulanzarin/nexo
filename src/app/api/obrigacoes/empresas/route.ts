import { apiRoute } from "@/lib/api-route";
import { listarCarteira } from "@/lib/obrigacoes";

/**
 * Carteira do Acessórias para o seletor de empresa. Vem do banco (a varredura a
 * guarda), não da API — escolher empresa não pode custar chamada externa.
 *
 * Recortada pelo escopo da sessão, como todo o resto: sem isso o seletor viraria
 * um diretório de clientes alheios para quem tem carteira restrita.
 */
export const GET = apiRoute(async () => listarCarteira());
