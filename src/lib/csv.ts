/**
 * Número decimal como o Excel pt-BR espera: vírgula. Sem isso a célula chega
 * como TEXTO (o separador do arquivo é `;`, então a planilha lê o ponto como
 * decimal errado ou como string) e ninguém consegue somar a coluna.
 */
export const decimalBR = (v: number | null | undefined): string =>
  v == null ? "" : v.toFixed(2).replace(".", ",");

/** Os 27 caracteres que o Windows-1252 põe na faixa 0x80–0x9F (o Latin-1 deixa vazia). */
const CP1252_ESPECIAIS: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Texto em Windows-1252, o encoding dos arquivos de importação que o próprio
 * Questor exporta como modelo. Mandar UTF-8 para ele vira "DescriÃ§Ã£o".
 * Caractere que não existe na tabela vira "?".
 */
export function bytesWindows1252(texto: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(texto.length);
  let n = 0;
  for (const ch of texto) {
    const cp = ch.codePointAt(0) ?? 0x3f;
    bytes[n++] = cp < 0x80 || (cp >= 0xa0 && cp <= 0xff) ? cp : (CP1252_ESPECIAIS[cp] ?? 0x3f);
  }
  return bytes.slice(0, n);
}

/**
 * Exporta uma tabela como CSV e dispara o download no navegador. Separador `;` e
 * BOM UTF-8 para o Excel pt-BR abrir com acentos e colunas certas.
 */
export function baixarCSV(
  nome: string,
  cabecalhos: string[],
  linhas: (string | number | null | undefined)[][]
): void {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [cabecalhos, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome.endsWith(".csv") ? nome : `${nome}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
