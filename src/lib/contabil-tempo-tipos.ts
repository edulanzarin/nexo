import type { CtbItem } from "./contabil-produtividade-tipos";

/**
 * Tipos da aba TEMPO da Produtividade do Contábil — quanto tempo cada pessoa
 * passou dentro do Questor, e em quais empresas.
 *
 * A fonte é o `tempouso`: uma linha por (dia, empresa, usuário) com o tempo em
 * SEGUNDOS. É o único lugar do banco que mede esforço em horas em vez de contar
 * linhas produzidas — e é o que permite perguntar quanto custa atender cada
 * cliente, não só quantos lançamentos ele gerou.
 *
 * Duas limitações que a tela precisa dizer em voz alta:
 *
 * 1. O `tempouso` é do QUESTOR INTEIRO, não do módulo contábil: a mesma linha
 *    conta a hora de quem estava na folha. Por isso o ranking só mostra quem
 *    lançou alguma coisa no `lctoctb` no período — o time do contábil —, e o
 *    tempo de quem ficou de fora vira uma nota de rodapé, nunca some calado.
 * 2. A tabela não tem filial (só empresa), então o filtro de filial não morde
 *    aqui. A `codigoatividade` existe mas está toda em "Não definido" nesta
 *    base — não dá para quebrar por atividade.
 */

export interface CtbTempoPessoa {
  codigo: number;
  nome: string;
  inativo: boolean;
  /** Horas no Questor no período (todas as empresas). */
  horas: number;
  /** Dias com algum tempo registrado. */
  dias: number;
  empresas: number;
  horasPorDia: number;
  /** Lançamentos contábeis no mesmo período — o outro lado da conta. */
  lancamentos: number;
  /** Lançamentos por hora. Comparável ENTRE pessoas; inflado por lote de importação. */
  porHora: number;
  topEmpresas: CtbItem[];
}

/** Uma empresa e o que ela consumiu de tempo do time contábil. */
export interface CtbTempoEmpresa {
  chave: string;
  nome: string;
  horas: number;
  pessoas: number;
  lancamentos: number;
  /** Minutos por lançamento — quanto custa cada linha nessa empresa. */
  minutosPorLancamento: number | null;
}

export interface CtbTempoPonto {
  bucket: string;
  horas: number;
}

export interface ContabilTempoResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: {
    horas: number;
    pessoas: number;
    empresas: number;
    dias: number;
    horasPorPessoaDia: number;
    /** Horas médias por empresa tocada — o que cada cliente custa de atenção. */
    horasPorEmpresa: number;
    lancamentos: number;
    /**
     * Lançamentos por hora do time. É ritmo BRUTO e infla muito: a importação
     * fiscal grava dezenas de milhares de linhas sem consumir hora humana. Serve
     * para comparar pessoas entre si, não como medida de esforço.
     */
    lancamentosPorHora: number;
  };
  /** Quem apareceu no `tempouso` sem lançar nada no contábil — outras áreas. */
  foraDoContabil: { pessoas: number; horas: number };
  ranking: CtbTempoPessoa[];
  empresas: CtbTempoEmpresa[];
  serie: CtbTempoPonto[];
  /** 7 posições, domingo a sábado: horas por dia da semana. */
  porDiaSemana: number[];
}
