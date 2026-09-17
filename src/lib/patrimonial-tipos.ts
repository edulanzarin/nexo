import type { OrigemCasamento, StatusCasamento } from "./implantacao-tipos";

/**
 * Formato CANÔNICO da implantação do patrimonial. Todo relatório de bens do
 * imobilizado, venha do sistema que vier (SCI, Domínio…), é reduzido a
 * `LeituraPatrimonial`. A conferência com os totais do relatório e o gerador do
 * arquivo do Questor são escritos uma vez contra este formato; sistema novo é só
 * um leitor novo em `patrimonial-pdf.ts`.
 */

/** Valores somados que o relatório imprime (por conta ou no fim). */
export interface TotaisBens {
  valor: number;
  depreciacao: number;
}

/** Conta contábil de origem que agrupa os bens no relatório. */
export interface ContaBens {
  /** Código da conta no sistema de origem ("102"). */
  chave: string;
  /** Classificação de origem, quando o relatório traz ("01.2.3.01.005"). */
  classif?: string;
  descricao: string;
  /** Total que o relatório imprime para a conta; null quando o layout não traz. */
  total: TotaisBens | null;
}

/** Um bem lido do relatório. */
export interface BemLido {
  /** Código do bem no sistema de origem — só para achar a linha no PDF. */
  codigo: string;
  /** `chave` da conta de origem a que o bem pertence. */
  conta: string;
  descricao: string;
  /** Data de aquisição, ISO "YYYY-MM-DD". */
  aquisicao: string;
  valor: number;
  /** Depreciação acumulada até a posição do relatório — vira o "Encargo Acumulado". */
  depreciacao: number;
  /** Taxa anual em % (20 = 20% ao ano). */
  taxa: number;
  quantidade: number;
  /**
   * Valor residual impresso, quando o layout traz. Não vai para o arquivo: é a
   * prova da leitura, porque valor − depreciação tem que dar ele.
   */
  residual?: number;
}

export interface LeituraPatrimonial {
  /** Sistema cujo layout foi reconhecido ("SCI"). */
  sistema: string;
  /** Data da posição do relatório (fim do período), ISO. */
  posicao: string | null;
  contas: ContaBens[];
  bens: BemLido[];
  /** Total geral impresso no fim do relatório. */
  totalGeral: TotaisBens | null;
}

/**
 * Prefixo da chave da conta no `implantacao_depara`. A conta do relatório de
 * bens é código do sistema de origem, e nem todo sistema agrupa bem por conta
 * contábil (há os que agrupam por grupo patrimonial): sem o prefixo, o "3" de um
 * grupo herdaria o de-para da conta "3" do balancete.
 */
export const PREFIXO_DEPARA_PATRIMONIAL = "patrimonial:";

/** Conta de origem casada com a conta do plano da empresa no Questor. */
export interface ContaBensCasada extends ContaBens {
  /** Conta reduzida do Questor que recebe os bens, ou null quando não casou. */
  conta: number | null;
  contaDescr?: string;
  status: StatusCasamento;
  via: OrigemCasamento | null;
  confianca: number;
}

/** Leitura com as contas já casadas — o que a tela recebe e edita. */
export interface LeituraPatrimonialCasada extends Omit<LeituraPatrimonial, "contas"> {
  contas: ContaBensCasada[];
}
