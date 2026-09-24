/**
 * Formatação do arquivo de importação de lançamentos contábeis do Questor
 * (layout "Layout Importação Lançamento Contábeis", extensão `.nli`).
 *
 * Cada linha é uma partida, delimitada por ';':
 *   C;empresa;estab;DD/MM/AAAA;contaDeb;contaCred;codHistorico;complemento;valor
 * decimal com vírgula; `TIPOLANCAMENTO='LN'` e `ORIGEMDADO='3'` são fixados pelo
 * próprio layout, não vão no arquivo. Compartilhado por Implantação (saldos de
 * abertura) e Conciliação (extrato bancário) — os dois geram o mesmo formato.
 */

/** Tamanho do campo COMPLHIST no layout — texto além disso é cortado. */
export const TAM_COMPLEMENTO = 300;

/** Data ISO "YYYY-MM-DD" → "DD/MM/AAAA". */
export function dataQuestor(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Valor absoluto com 2 casas e vírgula decimal, sem separador de milhar. */
export function valorQuestor(v: number): string {
  return Math.abs(v).toFixed(2).replace(".", ",");
}

/** Complemento livre: cortado no tamanho do campo, entre aspas só quando contém o separador ou aspas. */
export function complementoQuestor(texto: string): string {
  const cortado = texto.slice(0, TAM_COMPLEMENTO);
  if (cortado.includes(";") || cortado.includes('"')) {
    return `"${cortado.replace(/"/g, '""')}"`;
  }
  return cortado;
}

/** Uma linha do arquivo. Os campos já vêm formatados; aqui só junta com ';'. */
export function linhaNli(campos: (string | number)[]): string {
  return campos.join(";");
}

/** O arquivo inteiro: CRLF entre linhas e no fim (o `.nli` é gerado no Windows). */
export function montarArquivoNli(linhas: string[]): string {
  return linhas.join("\r\n") + (linhas.length ? "\r\n" : "");
}
