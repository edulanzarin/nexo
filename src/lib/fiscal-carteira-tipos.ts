import { montarFaixas } from "./prod-escala";

/**
 * Tipos da aba CARTEIRA da Produtividade do Fiscal — a leitura pelo lado do
 * CLIENTE, não pelo lado da pessoa.
 *
 * As outras abas respondem "quem trabalhou"; esta responde "quem foi atendido" —
 * e, mais importante, quem NÃO foi. Uma empresa ativa que passou o mês inteiro
 * sem uma única nota escriturada não aparece em ranking nenhum: ela é justamente
 * a ausência, e ausência só se vê comparando com a carteira inteira.
 *
 * Carteira ativa = empresa com estabelecimento sem data de encerramento. No
 * Questor a coluna nunca fica nula: quem está de pé leva a data-sentinela
 * `2100-12-31`, então "ativa" é `dataencerativ > hoje`.
 *
 * Mas ativa não quer dizer que o escritório faça o FISCAL dela — há cliente que
 * só tem folha ou só contabilidade aqui. Por isso a régua é a CARTEIRA FISCAL:
 * ativa que teve nota escriturada em algum momento nos últimos 12 meses. Sai do
 * mesmo `max(datahoralctofis)` que já é lido para o tempo parado, então não
 * custa consulta nova — e não depende de campo de contrato, que o Questor não tem.
 */

/** Tempo desde a última nota da empresa. Mesma escada do atraso. */
export const FAIXAS_PARADA_FISCAL = montarFaixas([
  { id: "recente", rotulo: "Até 30 dias", desde: 0 },
  { id: "mes", rotulo: "31 a 90 dias", desde: 31 },
  { id: "trimestre", rotulo: "91 a 180 dias", desde: 91 },
  { id: "semestre", rotulo: "181 a 365 dias", desde: 181 },
  { id: "ano", rotulo: "Mais de 1 ano ou nunca", desde: 366 },
]);

/** Empresa que nunca teve nota: entra na última faixa sem fingir uma idade. */
export const PARADA_NUNCA = 99_999;

export interface FisCarteiraEmpresa {
  codigo: number;
  nome: string;
  /** Estabelecimento sem encerramento — a empresa segue na carteira. */
  ativa: boolean;
  notas: number;
  valor: number;
  entradas: number;
  saidas: number;
  /** Quantas pessoas do time tocaram nela no período. */
  pessoas: number;
  /** Quem mais escriturou nela no período. */
  principal: string | null;
  /** Última nota de todos os tempos (YYYY-MM-DD), não só do período. */
  ultimo: string | null;
  /** Dias desde a última nota; null quando nunca teve nenhuma. */
  diasParada: number | null;
}

/** Um ponto da curva de concentração (Pareto) da carteira. */
export interface FisParetoPonto {
  pctEmpresas: number;
  pctNotas: number;
}

export interface FiscalCarteiraResp {
  periodo: { inicio: string; fim: string };
  totais: {
    /** Empresas ativas no cadastro (inclui quem só faz folha ou contábil aqui). */
    ativas: number;
    /** Carteira fiscal: ativas com nota nos últimos 12 meses. */
    fiscal: number;
    /** Ativas que nunca tiveram uma nota escriturada. */
    semNota: number;
    atendidas: number;
    paradas: number;
    /** Da carteira fiscal, quantas estão paradas há mais de 90 dias. */
    esquecidas: number;
    /** Atendidas sobre a carteira FISCAL, não sobre todas as ativas. */
    cobertura: number;
    notas: number;
    valor: number;
    /** Empresas que respondem por metade das notas do período. */
    metadeEm: number;
  };
  /** Carteira inteira: ativas + as que tiveram movimento mesmo estando baixadas. */
  empresas: FisCarteiraEmpresa[];
  /** Distribuição das ATIVAS por tempo desde a última nota. */
  porFaixa: number[];
  /** Quantas empresas foram tocadas por 1, 2, 3, 4 e 5+ pessoas. */
  porPessoas: number[];
  pareto: FisParetoPonto[];
}
