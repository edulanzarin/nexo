import { montarFaixas } from "./contabil-prod-escala";

/**
 * Tipos da aba ATRASO da Produtividade do Contábil — a distância entre o FATO e
 * o REGISTRO.
 *
 * O `lctoctb` tem duas datas: `datalctoctb` (a competência do fato) e
 * `datahoralctoctb` (quando a linha foi gravada). A aba Lançamentos usa a
 * segunda para medir trabalho; esta usa a diferença entre as duas para medir
 * ATRASO — e é o número que diz se o escritório está escriturando o mês
 * corrente ou correndo atrás de abril.
 *
 * A medida central é MEDIANA, não média: um lote de importação de dois anos
 * atrás puxa a média para o teto e some com a realidade do dia a dia.
 */

/** Dias entre a competência e o registro. Mesma escada da idade das exclusões. */
export const FAIXAS_ATRASO = montarFaixas([
  // O piso é aberto para baixo: lançamento com data futura (raro, mas existe)
  // tem atraso negativo e é tão "em dia" quanto o do mesmo dia.
  { id: "dia", rotulo: "Até 5 dias", desde: Number.NEGATIVE_INFINITY },
  { id: "mes", rotulo: "6 a 30 dias", desde: 6 },
  { id: "trimestre", rotulo: "31 a 90 dias", desde: 31 },
  { id: "semestre", rotulo: "91 a 180 dias", desde: 91 },
  { id: "velho", rotulo: "Mais de 180 dias", desde: 181 },
]);

export interface CtbAtrasoPessoa {
  codigo: number;
  nome: string;
  inativo: boolean;
  lancamentos: number;
  /** Mediana do atraso, em dias. */
  mediana: number | null;
  p90: number | null;
  /** Competências (meses do fato) distintas que ela tocou no período. */
  competencias: number;
  /** A competência mais antiga que ela mexeu ("YYYY-MM"). */
  maisVelha: string | null;
  empresas: number;
  porFaixa: number[];
}

export interface CtbAtrasoEmpresa {
  chave: string;
  nome: string;
  lancamentos: number;
  mediana: number | null;
  p90: number | null;
  maisVelha: string | null;
  porFaixa: number[];
}

/** Um mês de competência trabalhado no período. */
export interface CtbCompetencia {
  compet: string;
  qtd: number;
  mediana: number | null;
  /** Quantas pessoas mexeram nessa competência. */
  pessoas: number;
}

/** Um bucket da série: quanto o time andou atrasado naquele dia/mês de trabalho. */
export interface CtbAtrasoPonto {
  bucket: string;
  total: number;
  mediana: number | null;
  p90: number | null;
}

export interface ContabilAtrasoResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: {
    lancamentos: number;
    mediana: number | null;
    p90: number | null;
    /** Lançamentos na primeira faixa (registrados quase junto com o fato). */
    emDia: number;
    competencias: number;
    maisVelha: string | null;
    porFaixa: number[];
  };
  ranking: CtbAtrasoPessoa[];
  empresas: CtbAtrasoEmpresa[];
  competencias: CtbCompetencia[];
  serie: CtbAtrasoPonto[];
  /** Quantos lançamentos exigem quantos dias — mediana por lote de empresa. */
  minimoEmpresa: number;
}
