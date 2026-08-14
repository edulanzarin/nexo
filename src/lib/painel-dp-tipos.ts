/**
 * Tipos do Painel do DP — a home do módulo, um dashboard-resumo que carrega
 * sozinho (sem filtro/Executar). Compartilhados entre a lib server-only
 * (`painel-dp`) e o cliente. Cada bloco é INDEPENDENTE e opcional (`| null`): se
 * a consulta daquele bloco falhar, o painel ainda renderiza os outros.
 */

/** Rescisões a pagar em aberto (janela de acompanhamento). */
export interface PainelRescisoes {
  pendentes: number;
  vencidas: number;
  venceBreve: number;
}

/** Férias vencidas (dobro) e a vencer, no escritório todo. */
export interface PainelFerias {
  vencidas: number;
  aVencer: number;
}

/** eSocial a resolver: transmissões pendentes e rejeitadas (últimos 90 dias). */
export interface PainelEsocial {
  pendentes: number;
  rejeitados: number;
}

/** Contagem dos quatro trabalhos do DP num período. */
export interface PainelTrabalhos {
  avisos: number;
  rescisoes: number;
  admissoes: number;
  ferias: number;
  total: number;
}

/** Um operador do DP e quanto fez no período (top do ranking). */
export interface PainelOperador {
  nome: string;
  total: number;
}

/** O que o DP fez no mês corrente, com comparação ao período anterior. */
export interface PainelAtividade {
  mes: PainelTrabalhos;
  anterior: PainelTrabalhos;
  colaboradores: number;
  topOperadores: PainelOperador[];
}

/** Um ponto da série mensal dos quatro trabalhos. */
export interface PainelSeriePonto {
  bucket: string; // "YYYY-MM"
  avisos: number;
  rescisoes: number;
  admissoes: number;
  ferias: number;
}

/** Payload do painel: período de referência + os blocos (cada um pode faltar). */
export interface PainelDp {
  periodo: { inicio: string; fim: string };
  rescisoes: PainelRescisoes | null;
  ferias: PainelFerias | null;
  esocial: PainelEsocial | null;
  atividade: PainelAtividade | null;
  serie: PainelSeriePonto[] | null;
}
