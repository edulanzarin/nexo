/**
 * A tabela que uma tela entrega para exportar, e a leitura de cada célula que o
 * Excel e o PDF precisam. As telas montam as linhas pensando no CSV: valor em
 * `decimalBR` ("1234,56"), data em `dataBR` ("19/03/2025"). Em vez de pedir às
 * 41 telas que digam o tipo de cada coluna, o exportador reconhece esses dois
 * formatos, que são exatamente os que o NaveX escreve, e deixa o resto como
 * texto. Texto nunca vira número por engano: código com zero à esquerda, CNPJ
 * e competência ("09/2026") não casam com nenhum dos padrões.
 */

export type Celula = string | number | null | undefined;

/**
 * Acima disso o PDF passa de cem páginas e trava a aba montando. Quem precisa
 * de tudo leva a planilha, que abre qualquer tamanho. Mora aqui, e não junto do
 * PDF, para o menu consultar sem carregar o jsPDF.
 */
export const LIMITE_LINHAS_PDF = 5000;

export interface Tabela {
  cabecalhos: string[];
  linhas: Celula[][];
}

export type Lida =
  | { tipo: "vazio" }
  | { tipo: "texto"; valor: string }
  | { tipo: "numero"; valor: number }
  /** Número com casas decimais (valor em reais, percentual): sai com duas casas. */
  | { tipo: "decimal"; valor: number }
  /** Data (e hora, quando veio). `valor` é o instante em UTC, sem fuso. */
  | { tipo: "data"; valor: Date; comHora: boolean };

const DECIMAL_BR = /^-?(\d{1,3}(\.\d{3})+|\d+),\d+$/;
const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/;
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function data(a: number, m: number, d: number, h = 0, min = 0): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;
  const dt = new Date(Date.UTC(a, m - 1, d, h, min));
  // 31/02 vira 03/03 no Date: a volta confere que o dia existe.
  return dt.getUTCDate() === d && dt.getUTCMonth() === m - 1 ? dt : null;
}

export function lerCelula(v: Celula): Lida {
  if (v == null) return { tipo: "vazio" };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { tipo: "vazio" };
    return Number.isInteger(v) ? { tipo: "numero", valor: v } : { tipo: "decimal", valor: v };
  }
  const s = v.trim();
  if (!s) return { tipo: "vazio" };
  if (DECIMAL_BR.test(s)) return { tipo: "decimal", valor: Number(s.replace(/\./g, "").replace(",", ".")) };
  let m = DATA_BR.exec(s);
  if (m) {
    const dt = data(+m[3], +m[2], +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
    if (dt) return { tipo: "data", valor: dt, comHora: m[4] != null };
  }
  m = DATA_ISO.exec(s);
  if (m) {
    const dt = data(+m[1], +m[2], +m[3]);
    if (dt) return { tipo: "data", valor: dt, comHora: false };
  }
  return { tipo: "texto", valor: v };
}

/**
 * Coluna numérica: toda célula preenchida é número. Alinha à direita no PDF, e
 * uma coluna mista (número com "—" no meio) fica como texto, à esquerda.
 */
export function colunaNumerica(linhas: Celula[][], i: number): boolean {
  let alguma = false;
  for (const l of linhas) {
    const c = lerCelula(l[i]);
    if (c.tipo === "vazio") continue;
    if (c.tipo !== "numero" && c.tipo !== "decimal") return false;
    alguma = true;
  }
  return alguma;
}

const DEC = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dois = (n: number) => String(n).padStart(2, "0");

/**
 * A célula como texto de leitura (PDF): valor com milhar e duas casas, data em
 * dd/mm/aaaa. Inteiro sai cru: código de empresa, contrato e ano também são
 * inteiros, e "1.402" como código de empresa lê errado.
 */
export function textoCelula(v: Celula): string {
  const c = lerCelula(v);
  switch (c.tipo) {
    case "vazio":
      return "";
    case "numero":
      return String(c.valor);
    case "decimal":
      return DEC.format(c.valor);
    case "data": {
      const d = c.valor;
      const dia = `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
      return c.comHora ? `${dia} ${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}` : dia;
    }
    case "texto":
      return c.valor;
  }
}
