/**
 * Formato CANÔNICO da implantação de saldos. Todo balancete de origem — venha de
 * qual software vier (Systemar, Patrimonium, Domínio…) e por qual via (colar,
 * CSV, PDF) — é reduzido a `LinhaOrigem[]`. O de-para, a validação e o gerador do
 * arquivo do Questor são escritos UMA vez contra este formato; adicionar uma
 * origem nova é só um parser novo na frente que produz estas linhas.
 */

/** Uma conta analítica do balancete de origem, com seu saldo de abertura. */
export interface LinhaOrigem {
  /** Chave estável da conta no software de origem (código reduzido ou classif). */
  chave: string;
  /** Classificação hierárquica de origem, quando existir ("1.1.02.09"). */
  classif?: string;
  descricao: string;
  /** Saldo de abertura em MAGNITUDE (sempre >= 0). O sinal vem da natureza. */
  saldo: number;
  /**
   * Natureza do saldo na origem: "D" devedor, "C" credor. Quando o software marca
   * (sufixo D/C, parênteses), o parser preenche; quando não marca (o sinal é
   * implícito pela conta), fica undefined e o de-para resolve pela natureza da
   * conta de destino no Questor.
   */
  natureza?: "D" | "C";
}

/** Uma conta do plano da empresa no Questor (planoespec), alvo do de-para. */
export interface ContaAlvo {
  conta: number;
  classif: string;
  descricao: string;
  /** true = sintética (não recebe lançamento) — não é alvo válido. */
  sintetica: boolean;
  /** Natureza cadastrada: "D" devedora, "C" credora. */
  natureza: "D" | "C";
}

export type StatusCasamento = "casada" | "duvidosa" | "sem_conta";

/** Como o casamento foi obtido — para a tela mostrar a confiança. */
export type OrigemCasamento = "override" | "classif" | "descricao" | "manual";

/** Uma linha de origem já casada (ou não) com uma conta do Questor. */
export interface LinhaCasada {
  origem: LinhaOrigem;
  /** Conta reduzida de destino, ou null quando não casou. */
  conta: number | null;
  status: StatusCasamento;
  /** De onde veio o casamento (null quando sem_conta). */
  via: OrigemCasamento | null;
  /** Confiança 0–1 do casamento automático (para ordenar as duvidosas). */
  confianca: number;
  /** Descrição da conta de destino, para conferência na tela. */
  contaDescr?: string;
  /**
   * Natureza final do saldo: da origem quando marcada, senão da conta de destino.
   * Decide o lado do lançamento (D → débito na conta, C → crédito). Null quando
   * indeterminável (sem conta e sem natureza na origem).
   */
  natureza: "D" | "C" | null;
}

/** Padrões da implantação (banco do app), com o padrão global já resolvido. */
export interface ConfigImplantacao {
  contaImplantacao: number | null;
  codigoHistorico: number | null;
  complemento: string | null;
}

/** Parâmetros do lote a gerar — o que a tela coleta antes de baixar o arquivo. */
export interface ParamsGeracao {
  empresa: number;
  estab: number;
  /** Data dos lançamentos (data de entrada da empresa), ISO "YYYY-MM-DD". */
  data: string;
  contaImplantacao: number;
  codigoHistorico: number;
  complemento: string;
}
