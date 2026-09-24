/**
 * Tipos do módulo Obrigações — a fila de entregas do Acessórias.
 *
 * A fila é MATERIALIZADA (tabela `obr_entrega`, alimentada por um job): a API de
 * origem cobra uma chamada por empresa e tem teto de 100/min, então a varredura
 * não cabe num request. A consequência para a tela é que todo número vem com um
 * "de quando" — daí `SincronizacaoInfo` andar junto do dado, e não escondido.
 */

/** Estado da última varredura — o "de quando" de tudo que a tela mostra. */
export interface SincronizacaoInfo {
  /** Quando a última varredura CONCLUÍDA terminou. Null = nunca rodou. */
  concluidoEm: string | null;
  /** Uma varredura está rodando agora? */
  rodando: boolean;
  empresas: number;
  entregas: number;
  /** Empresas que falharam na última varredura: a fila está incompleta. */
  falhas: number;
}

/** Um setor com fila, para o filtro e para o placar por área. */
export interface SetorFila {
  dptoId: number;
  dptoNome: string;
  total: number;
  atrasadas: number;
  comMulta: number;
}

/** Uma pessoa (ou marcador do Acessórias) que responde por entregas pendentes. */
export interface ResponsavelFila {
  respId: number | null;
  respNome: string;
  total: number;
  atrasadas: number;
  comMulta: number;
  /** Dias de atraso da entrega mais velha — o pior caso da pilha. */
  piorAtraso: number | null;
}

/** Uma obrigação (o tipo de trabalho) com fila. */
export interface ObrigacaoFila {
  obrigacao: string;
  total: number;
  atrasadas: number;
}

/** Uma linha da fila, para a tabela. */
export interface EntregaFila {
  entId: number;
  cnpj: string;
  codigoempresa: number | null;
  empresa: string;
  obrigacao: string;
  competencia: string | null;
  prazo: string | null;
  status: string;
  multa: boolean;
  dptoId: number;
  dptoNome: string;
  respNome: string | null;
  /** Dias de atraso (negativo = ainda no prazo). Null quando não há prazo. */
  diasAtraso: number | null;
}

/** Payload da tela: o placar, os recortes e a fila. Cada bloco pode faltar. */
export interface PainelObrigacoes {
  sync: SincronizacaoInfo;
  total: number;
  atrasadas: number;
  comMulta: number;
  /** Entregas cuja empresa não existe no Questor — só visíveis a quem vê todas. */
  semParNoQuestor: number;
  setores: SetorFila[] | null;
  responsaveis: ResponsavelFila[] | null;
  obrigacoes: ObrigacaoFila[] | null;
  fila: EntregaFila[] | null;
}
