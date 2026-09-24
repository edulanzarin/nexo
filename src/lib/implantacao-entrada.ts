import type { LinhaOrigem } from "./implantacao-tipos";

/**
 * Helpers para reduzir um balancete de origem ao formato canônico `LinhaOrigem`.
 * O que multiplica por software (a extração de linhas do PDF) vive em
 * `implantacao-pdf.ts`; aqui ficam as duas regras que valem para qualquer
 * origem e são escritas uma vez:
 *  - interpretar o saldo (D/C por sufixo, parênteses ou sinal → magnitude +
 *    natureza);
 *  - filtrar sintéticas por hierarquia de prefixo (só analíticas entram, senão
 *    o saldo dos grupos duplicaria).
 */

/** Uma conta bruta extraída da origem, antes de virar canônica. */
export interface LinhaBruta {
  chave: string;
  classif?: string;
  descricao: string;
  saldo: number;
  natureza?: "D" | "C";
}

/**
 * Interpreta uma célula de saldo: magnitude + natureza (quando a origem marca).
 * Aceita "8.955.354,63D", "1.234,56C", "(1.234,56)", "-1.234,56", "1.234,56".
 */
export function parseValor(raw: string): { saldo: number; natureza?: "D" | "C" } | null {
  let s = raw.trim();
  if (!s) return null;

  let natureza: "D" | "C" | undefined;
  const suf = s.slice(-1).toUpperCase();
  if (suf === "D" || suf === "C") {
    natureza = suf as "D" | "C";
    s = s.slice(0, -1).trim();
  }

  // Parênteses ou sinal negativo = crédito (valor negativo na coluna).
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  }

  // Formato BR: '.' milhar, ',' decimal. Remove milhar, troca vírgula por ponto.
  const num = parseFloat(s.trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return null;

  if (negativo && !natureza) natureza = "C";
  return { saldo: Math.abs(num), natureza };
}

/** v é ancestral (sintética) de w? Hierarquia por prefixo (com ou sem pontos). */
function ehAncestral(v: string, w: string): boolean {
  if (v === w) return false;
  if (v.includes(".")) return w.startsWith(v + ".");
  return w.startsWith(v) && w.length > v.length;
}

/**
 * Reduz as contas brutas ao canônico: mantém só as FOLHAS (analíticas) com
 * saldo. Folha = valor de hierarquia (classif quando houver, senão a chave) que
 * não é prefixo de nenhuma outra — a própria hierarquia do balancete diz quem é
 * grupo.
 */
export function montarAnaliticas(bruto: LinhaBruta[]): LinhaOrigem[] {
  const hier = (r: LinhaBruta) => r.classif ?? r.chave;
  const todos = bruto.map(hier);
  const ehFolha = (r: LinhaBruta) => {
    const v = hier(r);
    return !todos.some((w) => ehAncestral(v, w));
  };

  return bruto
    .filter(ehFolha)
    .filter((r) => r.saldo > 0)
    .map((r) => ({
      chave: r.chave,
      classif: r.classif,
      descricao: r.descricao,
      saldo: r.saldo,
      natureza: r.natureza,
    }));
}
