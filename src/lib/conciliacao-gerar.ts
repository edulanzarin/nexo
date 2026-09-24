import { TAM_COMPLEMENTO } from "./nli";

/**
 * Gera o arquivo de importação da Conciliação para o Questor: um CSV de
 * lançamentos, uma linha por lançamento, sem cabeçalho —
 *
 *   filial,DDMMAAAA,contaDeb,contaCred,valor,codHistorico,"complemento"
 *
 * separado por vírgula, data sem barras, valor com PONTO decimal e o histórico
 * como texto livre. NÃO escreve no banco — devolve o texto que o contador
 * importa (a porta de escrita do ERP é a importação dele).
 *
 * Diferente da Implantação — que usa o layout `.nli`, ver [[nli]] —, aqui cada
 * lançamento JÁ é dupla partida completa: a conta do banco de um lado e a
 * contrapartida (da regra ou escolhida à mão) do outro. Então não há
 * transitória: cada lançamento pronto vira uma linha, com a SUA própria data
 * (a do movimento no extrato), não uma data de lote.
 */

/**
 * O texto do histórico vai por extenso no último campo, então o código do
 * histórico padrão vai sempre zerado — é o que diz "o histórico é este texto".
 */
const CODIGO_HISTORICO_LIVRE = 0;

/** Data ISO "YYYY-MM-DD" → "DDMMAAAA" (sem separador). */
export function dataCsvQuestor(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}${m}${y}`;
}

/** Valor absoluto com 2 casas e PONTO decimal, sem separador de milhar. */
export function valorCsvQuestor(v: number): string {
  return Math.abs(v).toFixed(2);
}

/**
 * Complemento livre: cortado no tamanho do campo e SEMPRE entre aspas — a
 * descrição do extrato costuma ter vírgula, e o campo é o último da linha.
 */
export function complementoCsvQuestor(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim().slice(0, TAM_COMPLEMENTO);
  return `"${limpo.replace(/"/g, '""')}"`;
}

export interface LancamentoCsv {
  /** Data do lançamento em ISO "YYYY-MM-DD". */
  data: string;
  contaDebito: number;
  contaCredito: number;
  /** Texto do complemento do histórico (histórico da regra ou a descrição). */
  complemento: string;
  /** Valor em módulo. */
  valor: number;
}

export interface ParamsConciliacao {
  /** Filial (estabelecimento) — primeiro campo de toda linha. */
  estab: number;
}

export interface ResultadoConciliacao {
  /** Conteúdo do arquivo (uma linha por lançamento, terminador CRLF). */
  arquivo: string;
  /** Quantas linhas foram geradas. */
  linhas: number;
  /** Σ dos débitos e créditos — iguais, porque cada linha é uma dupla partida. */
  total: number;
}

export function gerarArquivoConciliacao(
  lancamentos: LancamentoCsv[],
  params: ParamsConciliacao
): ResultadoConciliacao {
  const linhas: string[] = [];
  let total = 0;

  for (const l of lancamentos) {
    if (Math.abs(l.valor) < 0.005) continue;
    total += Math.abs(l.valor);
    linhas.push(
      [
        params.estab,
        dataCsvQuestor(l.data),
        l.contaDebito,
        l.contaCredito,
        valorCsvQuestor(l.valor),
        CODIGO_HISTORICO_LIVRE,
        complementoCsvQuestor(l.complemento ?? ""),
      ].join(",")
    );
  }

  return {
    // CRLF entre linhas e no fim: o arquivo é lido por app Windows.
    arquivo: linhas.join("\r\n") + (linhas.length ? "\r\n" : ""),
    linhas: linhas.length,
    total,
  };
}
