import { montarFaixas } from "./prod-escala";

/**
 * Tipos da aba CARTEIRA da Produtividade do Contábil — a leitura pelo lado do
 * CLIENTE, não pelo lado da pessoa.
 *
 * As outras abas respondem "quem trabalhou"; esta responde "quem foi atendido" —
 * e, mais importante, quem NÃO foi. Uma empresa ativa que passou o mês inteiro
 * sem um único lançamento não aparece em ranking nenhum: ela é justamente a
 * ausência, e ausência só se vê comparando com a carteira inteira.
 *
 * Carteira ativa = empresa com estabelecimento sem data de encerramento. No
 * Questor a coluna nunca fica nula: quem está de pé leva a data-sentinela
 * `2100-12-31`, então "ativa" é `dataencerativ > hoje`.
 *
 * Mas ativa não quer dizer que o escritório faça a CONTABILIDADE dela: das 1392
 * ativas em ago/2026, 197 nunca tiveram um lançamento contábil (são clientes de
 * folha ou fiscal). Usar as 1392 como denominador de cobertura afundaria o
 * número com empresa que nunca deveria aparecer ali. Por isso a régua é a
 * CARTEIRA CONTÁBIL: ativa que teve lançamento em algum momento nos últimos 12
 * meses. Sai do mesmo `max(datahoralctoctb)` que já é lido para o tempo parado,
 * então não custa consulta nova — e não depende de nenhum campo de contrato,
 * que o Questor não tem.
 */

/** Tempo desde o último lançamento da empresa. Mesma escada do atraso. */
export const FAIXAS_PARADA = montarFaixas([
  { id: "recente", rotulo: "Até 30 dias", desde: 0 },
  { id: "mes", rotulo: "31 a 90 dias", desde: 31 },
  { id: "trimestre", rotulo: "91 a 180 dias", desde: 91 },
  { id: "semestre", rotulo: "181 a 365 dias", desde: 181 },
  { id: "ano", rotulo: "Mais de 1 ano ou nunca", desde: 366 },
]);

/** Empresa que nunca teve lançamento: entra na última faixa sem fingir uma idade. */
export const PARADA_NUNCA = 99_999;

export interface CtbCarteiraEmpresa {
  codigo: number;
  nome: string;
  /** Estabelecimento sem encerramento — a empresa segue na carteira. */
  ativa: boolean;
  lancamentos: number;
  valor: number;
  /** Quantas pessoas do time tocaram nela no período. */
  pessoas: number;
  /** Quem mais lançou nela no período. */
  principal: string | null;
  /** Último lançamento de todos os tempos (YYYY-MM-DD), não só do período. */
  ultimo: string | null;
  /** Dias desde o último lançamento; null quando nunca teve nenhum. */
  diasParada: number | null;
}

/** Um ponto da curva de concentração (Pareto) da carteira. */
export interface CtbParetoPonto {
  /** % das empresas atendidas, acumulado. */
  pctEmpresas: number;
  /** % dos lançamentos, acumulado. */
  pctItens: number;
}

export interface ContabilCarteiraResp {
  periodo: { inicio: string; fim: string };
  totais: {
    /** Empresas ativas no cadastro (inclui quem só faz folha ou fiscal aqui). */
    ativas: number;
    /** Carteira contábil: ativas com lançamento nos últimos 12 meses. */
    contabil: number;
    /** Ativas que nunca tiveram um lançamento contábil. */
    semLancamento: number;
    atendidas: number;
    paradas: number;
    /** Da carteira contábil, quantas estão paradas há mais de 90 dias. */
    esquecidas: number;
    /** Atendidas sobre a carteira CONTÁBIL, não sobre todas as ativas. */
    cobertura: number;
    lancamentos: number;
    valor: number;
    /** Empresas que respondem por metade dos lançamentos do período. */
    metadeEm: number;
  };
  /** Carteira inteira: ativas + as que tiveram movimento mesmo estando baixadas. */
  empresas: CtbCarteiraEmpresa[];
  /** Distribuição das ATIVAS por tempo desde o último lançamento. */
  porFaixa: number[];
  /** Quantas empresas foram tocadas por 1, 2, 3, 4 e 5+ pessoas. */
  porPessoas: number[];
  pareto: CtbParetoPonto[];
}
