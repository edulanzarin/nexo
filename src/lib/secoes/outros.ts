import { secoesPostMortem } from "./postmortem";
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

export const SECOES_RH: Secao[] = [
  secao("rh", "painel", "Painel", "painel", "Visão", "Pendências e panorama do mês"),
  secao("rh", "diretorio", "Diretório", "pessoas", "Pessoas", "Funcionários, com filtro e ficha"),
  secao("rh", "experiencia", "Experiência", "calendario", "Pessoas", "Avaliação de 45 e 90 dias"),
  secao("rh", "desempenho", "Desempenho", "tendencia", "Pessoas", "Avaliação respondida pelos gestores"),
  secao("rh", "formularios", "Formulários", "relatorio", "Canais", "Formulários e envios aos gestores"),
  secao("rh", "rotatividade", "Rotatividade", "rotatividade", "Pessoas", "Turnover das empresas do RH"),
  secao("rh", "denuncias", "Denúncias", "escudo", "Canais", "Canal anônimo: fila, tratativa e status"),
  secao("rh", "clima", "Avaliações", "coracao", "Canais", "eNPS, temas e comentários"),
  secao("rh", "gestores", "Gestores", "pessoas", "Pessoas", "Supervisores e coordenadores por setor"),
];

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

export const SECOES_SOCIETARIO: Secao[] = [...secoesPostMortem("societario", "Equipe")];

export const SECOES_CONFIG: Secao[] = [
  secao("config", "grupos-empresa", "Grupos de Empresa", "camadas", "Cadastros", "Empresas agrupadas por grupo de negócio"),
];
