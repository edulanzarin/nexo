import type { Secao } from "./tipos";

/**
 * Seções dos módulos que ainda não foram refeitos no NaveX. Existem desde já
 * porque a permissão é por seção: o cargo que concede `fiscal/painel` precisa
 * que a seção exista para o módulo aparecer como "a caminho" para quem a tem,
 * e para a matriz de permissões listar o que já está cadastrado no banco.
 *
 * As telas e as abas entram quando o módulo for refeito.
 */
function secao(modulo: string, id: string, rotulo: string, icone: string, grupo: string, descricao: string): Secao {
  const path = `/${modulo}/${id}`;
  return { id, rotulo, icone, grupo, path, descricao, abas: [] };
}

/** Setores do Acessórias que cada seção mostra (ids do Acessórias; vazio = todos). */
export const SETORES_OBRIGACOES: Record<string, number[]> = {
  geral: [],
  contabil: [1, 50, 27],
  fiscal: [2],
  dp: [3],
  configuracoes: [],
};

export const SECOES_OBRIGACOES: Secao[] = [
  secao("obrigacoes", "geral", "Visão Geral", "grade", "Filas", "Entregas do escritório inteiro"),
  secao("obrigacoes", "contabil", "Contábil", "calculadora", "Filas", "Balancetes e escriturações pendentes"),
  secao("obrigacoes", "fiscal", "Fiscal", "recibo", "Filas", "Guias, apurações e declarações pendentes"),
  secao("obrigacoes", "dp", "DP", "pessoas", "Filas", "Folha, encargos e obrigações de pessoal"),
  secao("obrigacoes", "configuracoes", "Configurações", "engrenagem", "Integração", "Varredura do Acessórias"),
];
