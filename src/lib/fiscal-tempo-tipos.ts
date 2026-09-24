import type { ProdItem } from "./prod-tipos";

/**
 * Tipos da aba TEMPO da Produtividade do Fiscal — quanto tempo cada pessoa
 * passou dentro do Questor, e em quais empresas.
 *
 * A fonte é o `tempouso`: uma linha por (dia, empresa, usuário) com o tempo em
 * SEGUNDOS. É o único lugar do banco que mede esforço em horas em vez de contar
 * linhas produzidas — e é o que permite perguntar quanto custa atender cada
 * cliente, não só quantas notas ele gerou.
 *
 * Duas limitações que a tela precisa dizer em voz alta:
 *
 * 1. O `tempouso` é do QUESTOR INTEIRO, não do módulo fiscal: a mesma linha
 *    conta a hora de quem estava na folha. Por isso o ranking só mostra quem
 *    escriturou nota no período — o time do fiscal —, e o tempo de quem ficou de
 *    fora vira nota de rodapé, nunca some calado.
 * 2. A tabela não tem filial (só empresa), então o filtro de filial não morde
 *    aqui. A `codigoatividade` existe mas está toda em "Não definido" nesta
 *    base — não dá para quebrar por atividade.
 *
 * E uma ressalva própria do Fiscal, mais forte que a do Contábil: ~98% das notas
 * entram por integração, sem consumir hora humana. "Notas por hora" aqui é ritmo
 * BRUTO, serve para comparar pessoas entre si e não como medida de esforço.
 */

export interface FisTempoPessoa {
  codigo: number;
  nome: string;
  inativo: boolean;
  /** Horas no Questor no período (todas as empresas). */
  horas: number;
  /** Dias com algum tempo registrado. */
  dias: number;
  empresas: number;
  horasPorDia: number;
  /** Notas escrituradas no mesmo período — o outro lado da conta. */
  notas: number;
  /** Notas digitadas ou importadas: o pedaço que de fato consome a hora. */
  aDedo: number;
  /** Notas por hora. Comparável ENTRE pessoas; inflado pela integração. */
  porHora: number;
  topEmpresas: ProdItem[];
}

/** Uma empresa e o que ela consumiu de tempo do time fiscal. */
export interface FisTempoEmpresa {
  chave: string;
  nome: string;
  horas: number;
  pessoas: number;
  notas: number;
  /** Minutos por nota — quanto custa cada documento nessa empresa. */
  minutosPorNota: number | null;
}

export interface FisTempoPonto {
  bucket: string;
  horas: number;
}

export interface FiscalTempoResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: {
    horas: number;
    pessoas: number;
    empresas: number;
    dias: number;
    horasPorPessoaDia: number;
    /** Horas médias por empresa tocada — o que cada cliente custa de atenção. */
    horasPorEmpresa: number;
    notas: number;
    aDedo: number;
    /** Ritmo bruto do time. Ver a ressalva no cabeçalho deste arquivo. */
    notasPorHora: number;
    /** O mesmo ritmo contando só o que não veio da integração — o número honesto. */
    aDedoPorHora: number;
  };
  /** Quem apareceu no `tempouso` sem escriturar nota — outras áreas. */
  foraDoFiscal: { pessoas: number; horas: number };
  ranking: FisTempoPessoa[];
  empresas: FisTempoEmpresa[];
  serie: FisTempoPonto[];
  /** 7 posições, domingo a sábado: horas por dia da semana. */
  porDiaSemana: number[];
}
