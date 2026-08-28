import { montarFaixas } from "./prod-escala";

/**
 * Tipos da aba ATRASO da Produtividade do Fiscal — a distância entre o
 * DOCUMENTO e a ESCRITURAÇÃO.
 *
 * O cabeçalho da nota tem duas datas: `datalctofis` (a data do documento, que é
 * a competência) e `datahoralctofis` (quando a linha foi gravada). A aba
 * Lançamentos usa a segunda para medir trabalho; esta usa a diferença entre as
 * duas para medir atraso — e é o número que diz se o time está fechando o mês
 * passado ou correndo atrás de abril.
 *
 * A ESCADA AQUI NÃO É A DO CONTÁBIL, de propósito. No contábil "em dia" são 5
 * dias; no fiscal, escriturar o mês anterior durante o mês seguinte é o ciclo
 * NORMAL — a defasagem mediana medida em jul/2026 foi de 25 dias, com massa
 * entre 18 e 33. Usar a régua do contábil pintaria o escritório inteiro de
 * vermelho e a tela não distinguiria mais nada. O primeiro degrau é, então, "até
 * 30 dias": dentro do ciclo. Quem passa de 60 é que está devendo.
 *
 * A medida central é MEDIANA, não média: uma importação de dois anos atrás puxa
 * a média para o teto e some com a realidade do dia a dia.
 */
export const FAIXAS_ATRASO_FISCAL = montarFaixas([
  // Piso aberto para baixo: nota lançada antes da data do documento (raro, mas
  // acontece em emissão própria) tem atraso negativo e é tão "em dia" quanto zero.
  { id: "ciclo", rotulo: "Até 30 dias", desde: Number.NEGATIVE_INFINITY },
  { id: "mes", rotulo: "31 a 60 dias", desde: 31 },
  { id: "trimestre", rotulo: "61 a 90 dias", desde: 61 },
  { id: "semestre", rotulo: "91 a 180 dias", desde: 91 },
  { id: "velho", rotulo: "Mais de 180 dias", desde: 181 },
]);

export interface FisAtrasoPessoa {
  codigo: number;
  nome: string;
  inativo: boolean;
  notas: number;
  /** Mediana do atraso, em dias. */
  mediana: number | null;
  p90: number | null;
  /** Competências (meses do documento) distintas que ela tocou no período. */
  competencias: number;
  /** A competência mais antiga em que mexeu ("YYYY-MM"). */
  maisVelha: string | null;
  empresas: number;
  porFaixa: number[];
}

export interface FisAtrasoEmpresa {
  chave: string;
  nome: string;
  notas: number;
  mediana: number | null;
  p90: number | null;
  maisVelha: string | null;
  porFaixa: number[];
}

/** Um mês de competência escriturado no período. */
export interface FisCompetencia {
  compet: string;
  qtd: number;
  mediana: number | null;
  /** Quantas pessoas mexeram nessa competência. */
  pessoas: number;
}

/** Um bucket da série: quanto o time andou atrasado naquele dia/mês de trabalho. */
export interface FisAtrasoPonto {
  bucket: string;
  total: number;
  mediana: number | null;
  p90: number | null;
}

export interface FiscalAtrasoResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: {
    notas: number;
    mediana: number | null;
    p90: number | null;
    /** Notas na primeira faixa — escrituradas dentro do ciclo normal. */
    noCiclo: number;
    competencias: number;
    maisVelha: string | null;
    porFaixa: number[];
  };
  ranking: FisAtrasoPessoa[];
  empresas: FisAtrasoEmpresa[];
  competencias: FisCompetencia[];
  serie: FisAtrasoPonto[];
  /** Piso de notas para uma empresa entrar no ranking (mediana de 3 notas mente). */
  minimoEmpresa: number;
}
