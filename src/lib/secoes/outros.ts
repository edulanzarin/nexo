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

export const SECOES_FISCAL: Secao[] = [
  secao("fiscal", "painel", "Painel", "painel", "Visão", "Resumo da movimentação"),
  secao("fiscal", "analises", "Análises", "tendencia", "Visão", "Rankings e distribuições"),
  secao("fiscal", "tributos", "Tributos", "moedas", "Rotina", "Carga, DIFAL e regime"),
  secao("fiscal", "conformidade", "Conformidade", "escudo", "Rotina", "Pendências e saúde fiscal"),
  secao("fiscal", "dados", "Dados", "nota", "Rotina", "Todas as notas, com filtros"),
  secao("fiscal", "produtividade", "Produtividade", "velocimetro", "Equipe", "Notas, apuração, impostos, atraso, carteira e tempo"),
  ...secoesPostMortem("fiscal", "Equipe"),
];

export const SECOES_FOLHA: Secao[] = [
  secao("folha", "painel-gestao", "Painel da equipe", "painel", "Visão", "Pendências e atividade do DP no mês"),
  secao("folha", "painel", "Meu painel", "grade", "Visão", "Rescisões a pagar, férias vencidas e eSocial"),
  secao("folha", "rotatividade", "Rotatividade", "rotatividade", "Análise", "Admissões e desligamentos sobre o efetivo"),
  secao("folha", "produtividade", "Produtividade", "velocimetro", "Equipe", "Movimentação, férias, folha e eSocial por colaborador"),
  secao("folha", "custo", "Custo de folha", "moedas", "Análise", "Proventos por rubrica, tipo e setor"),
  secao("folha", "esocial", "eSocial", "escudo", "Rotina", "Eventos aceitos, pendentes e rejeitados"),
  secao("folha", "ferias", "Férias", "calendario", "Rotina", "Férias vencidas e a vencer"),
  secao("folha", "rescisoes", "Rescisões a pagar", "recibo", "Rotina", "Prazo de pagamento e avisos por e-mail"),
  ...secoesPostMortem("folha", "Equipe"),
];

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
  secao("obrigacoes", "geral", "Visão geral", "grade", "Filas", "Entregas do escritório inteiro"),
  secao("obrigacoes", "contabil", "Contábil", "calculadora", "Filas", "Balancetes e escriturações pendentes"),
  secao("obrigacoes", "fiscal", "Fiscal", "recibo", "Filas", "Guias, apurações e declarações pendentes"),
  secao("obrigacoes", "dp", "DP", "pessoas", "Filas", "Folha, encargos e obrigações de pessoal"),
  secao("obrigacoes", "configuracoes", "Configurações", "engrenagem", "Integração", "Varredura do Acessórias"),
];

export const SECOES_SOCIETARIO: Secao[] = [...secoesPostMortem("societario", "Equipe")];

export const SECOES_CONFIG: Secao[] = [
  secao("config", "grupos-empresa", "Grupos de empresa", "camadas", "Cadastros", "Empresas agrupadas por grupo de negócio"),
];
