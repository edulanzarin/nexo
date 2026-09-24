/**
 * Tipos do Controle de Rescisões — compartilhados entre a lib server-only
 * (`rescisoes`) e o cliente (hooks/telas). Ficam fora da lib de queries porque
 * ela importa `db`/`server-only`; o tipo é apagado no build, mas manter o
 * contrato num arquivo neutro evita puxar código de servidor pro bundle (mesmo
 * padrão de `dp-tipos`).
 */

/**
 * Situação da rescisão na fila de pagamento. `resolvida` = paga/homologada (por
 * override manual ou pela folha de rescisão fechada no Questor). As demais são
 * pendentes, pela urgência contra o prazo: `vencida` já passou do prazo,
 * `vence_breve` está dentro da antecedência de aviso, `no_prazo` ainda folgado.
 */
export type RescisaoSituacao = "vencida" | "vence_breve" | "no_prazo" | "resolvida";

/** De onde veio o sinal de "resolvida": marcação manual do DP ou a folha do Questor. */
export type RescisaoResolvidaFonte = "manual" | "questor";

/** Uma rescisão na fila: o fato do Questor + a situação derivada do prazo. */
export interface RescisaoItem {
  codigoempresa: number;
  empresa: string;
  contrato: number;
  funcionario: string;
  /** Data do desligamento (funccontrato.datadem), "YYYY-MM-DD". */
  dataDesligamento: string;
  /** Motivo (causademissao), quando a rescisão já foi calculada. */
  causa: string | null;
  /** Data do aviso prévio (rescisao.dataavprevio), quando houver. */
  dataAviso: string | null;
  /** A folha de rescisão (tipo 60) já foi calculada no Questor. */
  calculada: boolean;
  /** Data de pagamento PREVISTA na folha do Questor (informativo, não resolve). */
  pgtoPrevisto: string | null;
  /** Prazo de pagamento = desligamento + prazo_dias, "YYYY-MM-DD". */
  prazo: string;
  /** Dias do prazo até a referência (negativo = vencida). null se resolvida. */
  diasParaPrazo: number | null;
  situacao: RescisaoSituacao;
  /** Data em que foi paga/homologada, "YYYY-MM-DD" (null = pendente). */
  resolvidaEm: string | null;
  resolvidaFonte: RescisaoResolvidaFonte | null;
  /** Observação da marcação manual. */
  observacao: string | null;
}

/** Cabeçalho da tela: contagens do período + o item a item. */
export interface RescisoesResumo {
  /** Data de referência do cálculo de prazo (o fim do período do filtro). */
  referencia: string;
  prazoDias: number;
  diasAntes: number;
  total: number;
  pendentes: number;
  vencidas: number;
  venceBreve: number;
  resolvidas: number;
  itens: RescisaoItem[];
}

/** Configuração editável (prazo + antecedência do aviso). */
export interface RescisoesConfig {
  prazoDias: number;
  diasAntes: number;
}

/** Um destinatário dos avisos de rescisão (time do DP). */
export interface RescisaoDestinatario {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
}
