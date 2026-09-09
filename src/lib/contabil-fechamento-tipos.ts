/**
 * Tipos da aba FECHAMENTO da Produtividade do Contábil — a única aba que cruza
 * duas fontes: o Questor diz o que foi lançado, o Acessórias diz de quem é a
 * empresa.
 *
 * O que marca o fechamento de uma competência: LANÇAMENTO NA CONTA DE
 * ENCERRAMENTO DO EXERCÍCIO (`classifconta` 7.1.01.001 no plano de cada
 * empresa — a reduzida 4855 em 1.363 das 1.368 que a têm). É a apuração do
 * resultado: débito/crédito contra Lucros (2538) ou Prejuízos (2539), origem
 * `CB` (digitada na contabilidade), com histórico do tipo "RESULTADO APURADO MES
 * 07/2026". Sai um por empresa por competência, e só existe se alguém apurou —
 * é o que o torna um marcador honesto de "mês fechado".
 *
 * A conta é resolvida pela CLASSIFICAÇÃO, não pelo código reduzido: 4855 é
 * "Encerramento do Exercício" em 1.363 empresas, mas em uma delas é
 * "PARTICIPAÇÕES NOS LUCROS" (4.3.03.01). Fixar o número contaria fechamento
 * onde não houve.
 */

/** Situação de uma empresa numa competência. */
export type SituacaoFechamento =
  /** Tem lançamento na conta de encerramento na competência. */
  | "fechada"
  /** Teve movimento contábil na competência, mas ninguém apurou o resultado. */
  | "aberta"
  /** Nenhuma escrituração na competência — não há o que fechar. */
  | "sem-movimento"
  /** Empresa do Acessórias sem par no Questor: não dá para medir. */
  | "sem-par";

export interface CtbFechamentoEmpresa {
  /** Par no Questor; null quando a empresa só existe no Acessórias. */
  codigo: number | null;
  cnpj: string;
  nome: string;
  /** Responsável pelo setor Contábil no Acessórias; null = sem dono. */
  analista: string | null;
  /**
   * Grupos de empresa do ACESSÓRIAS a que ela pertence (nome, já aparado).
   * Vazio é o normal — a maioria das empresas não é de grupo nenhum. Lista, e
   * não campo único, porque o modelo de lá é grupo -> empresas e nada impede a
   * segunda ligação. Não confundir com o grupo de Configurações do Nexo.
   */
  grupos: string[];
  /** Uma situação por competência, na ordem de `meses`. */
  situacoes: SituacaoFechamento[];
  /** Quando o fechamento mais recente do período foi REGISTRADO (não a
   *  competência: a hora em que a linha entrou no Questor). */
  registradoEm: string | null;
  /** Quem registrou esse fechamento — pode não ser o responsável da carteira. */
  fechadoPor: string | null;
  /** Competência mais recente já fechada, de todos os tempos (YYYY-MM-01). */
  ultimaCompetencia: string | null;
  /** Competências entre a última fechada e a de referência. Null = nunca fechou. */
  mesesAtras: number | null;
}

export interface CtbFechamentoAnalista {
  nome: string;
  /** Empresas medíveis: com par no Questor e escrituradas na referência. */
  carteira: number;
  fechadas: number;
  abertas: number;
  semMovimento: number;
  /** Fechadas sobre as medíveis (0–1). */
  pct: number;
}

export interface CtbFechamentoMes {
  mes: string;
  fechadas: number;
  abertas: number;
}

export interface ContabilFechamentoResp {
  periodo: { inicio: string; fim: string };
  /** Competências abrangidas pelo período (YYYY-MM-01). */
  meses: string[];
  /** Competência dos indicadores: a mais recente do período. */
  referencia: string;
  /**
   * A referência ainda está em curso (é o mês corrente). O fechamento acontece
   * DEPOIS do mês terminar, então aqui o número baixo é o esperado — sem esse
   * aviso, abrir a tela no dia 3 mostra o escritório inteiro "em aberto".
   */
  referenciaEmCurso: boolean;
  carteira: {
    /** Fim da última sincronização com o Acessórias. Null = nunca sincronizou. */
    atualizadoEm: string | null;
    /** Empresas ativas na carteira do setor Contábil. */
    empresas: number;
    /** Dessas, quantas não têm par no Questor. */
    semPar: number;
    /** Quantas o recorte de empresa/permissão deixou de fora. */
    foraDoEscopo: number;
    /** Quantas o filtro de grupo do Acessórias deixou de fora (0 sem filtro). */
    foraDoGrupo: number;
    /** Uma varredura está em curso agora. */
    sincronizando: boolean;
  };
  totais: {
    /** Empresas medíveis na referência. */
    carteira: number;
    fechadas: number;
    abertas: number;
    semMovimento: number;
    pct: number;
    /** Com movimento e sem nenhum fechamento em toda a história. */
    nuncaFecharam: number;
  };
  porAnalista: CtbFechamentoAnalista[];
  porMes: CtbFechamentoMes[];
  empresas: CtbFechamentoEmpresa[];
}
