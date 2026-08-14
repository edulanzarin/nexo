/**
 * Tipos do Painel do Contábil — a home do módulo. Diferente do DP (que é fila de
 * pendências), aqui o retrato é de ATIVIDADE: o que o time rodou no app (nada de
 * disparar automação, só contar) + a BASE configurada acumulada. Fonte: a trilha
 * `auditoria` e as tabelas `conf_*`/`implantacao_*` do banco do app.
 *
 * Cada bloco é independente e opcional (`| null`): se uma consulta falha, o
 * painel ainda mostra os outros.
 */

/** O que o time do Contábil rodou no período (contadores da trilha de auditoria). */
export interface ContabilAtividade {
  conciliacoes: number;
  /** Lançamentos gerados nas conciliações (soma de detalhe.linhas). */
  conciliacaoLinhas: number;
  implantacoes: number;
  laudos: number;
  pendenciasTriadas: number;
  pendenciasResolvidas: number;
  pendenciasIgnoradas: number;
  exportacoes: number;
}

/** Tamanho da base configurada no app (o conhecimento acumulado). */
export interface ContabilBase {
  plano: number; // conf_cfop_contabiliza (CFOPs com regra de contabilização)
  regras: number; // conf_regra (regras de contabilização detalhadas)
  regrasExtrato: number; // conf_regra_extrato ativas
  contasBanco: number; // conf_conta_banco
  depara: number; // implantacao_depara
}

/** Um ponto da série mensal de trabalhos rodados. */
export interface ContabilSeriePonto {
  bucket: string; // "YYYY-MM"
  conciliacoes: number;
  implantacoes: number;
  laudos: number;
}

/** Um evento recente da trilha (feed de atividade). */
export interface ContabilEvento {
  id: number;
  usuario: string;
  acao: string;
  alvo: string | null;
  quando: string; // "YYYY-MM-DDTHH:MM:SS"
}

/** Payload do painel: período de referência + os blocos (cada um pode faltar). */
export interface PainelContabil {
  periodo: { inicio: string; fim: string };
  atividade: ContabilAtividade | null;
  base: ContabilBase | null;
  serie: ContabilSeriePonto[] | null;
  recentes: ContabilEvento[] | null;
}
