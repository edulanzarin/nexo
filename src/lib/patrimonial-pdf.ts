import type { ModoTextoPdf } from "./pdf-texto";
import type { BemLido, ContaBens, LeituraPatrimonial, TotaisBens } from "./patrimonial-tipos";

/**
 * Leitores do relatório de bens do imobilizado. O relatório muda com o sistema
 * que a contabilidade anterior usava, então isto é um registro (mesmo desenho do
 * extrato): o primeiro leitor que reconhecer o layout assume. Todos devolvem o
 * formato canônico de `patrimonial-tipos.ts`.
 *
 * O que torna a leitura confiável não é o leitor acertar sempre, é ele NÃO PODER
 * errar calado: todo layout conhecido imprime o residual do bem e o total de
 * cada conta, e a conferência (`patrimonial-conferencia.ts`) cobra os dois.
 */
export interface LeitorPatrimonial {
  sistema: string;
  /** Nome do relatório no sistema, para dizer ao usuário qual PDF tirar. */
  relatorio: string;
  /** Como o texto do PDF precisa ser extraído para este layout. */
  modo: ModoTextoPdf;
  /**
   * Reconhece o relatório pelo texto. Marcador de LAYOUT (título, cabeçalho de
   * coluna), não nome de sistema: o rodapé com o nome é a primeira coisa que
   * some quando o escritório configura o relatório.
   */
  reconhece: (texto: string) => boolean;
  ler: (texto: string) => LeituraPatrimonial;
}

/** "1.234.567,89" → 1234567.89 */
function valorBR(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

/** "31/12/2021" → "2021-12-31" */
function isoDeBR(s: string): string {
  const [d, m, a] = s.split("/");
  return `${a}-${m}-${d}`;
}

/**
 * Dinheiro com 2 casas. Não casa pedaço de número maior (os valores "em moeda"
 * têm 6 casas, "1.458.020,330000") nem a taxa, que vem seguida de "%".
 */
const RE_DINHEIRO = /(?<![\d.,])\d{1,3}(?:\.\d{3})*,\d{2}(?![\d,])(?!\s*%)/g;
const RE_TAXA = /(?<![\d.,])(\d{1,3},\d{2})\s*%/;

function dinheiros(texto: string): number[] {
  return [...texto.matchAll(RE_DINHEIRO)].map((m) => valorBR(m[0]));
}

/** Centavos de arredondamento entre colunas impressas. */
const TOL = 0.02;

/**
 * Das colunas candidatas, o par (valor, depreciação) que fecha com o residual.
 * Serve para não depender da ordem exata em que o PDF desenha colunas que quase
 * sempre são iguais (valor × valor corrigido, depreciação acumulada × do
 * período) — quando diferem, só a certa fecha. Sem par que feche, fica o
 * preferido, e a conferência aponta o bem.
 */
function parQueFecha(
  valores: number[],
  depreciacoes: number[],
  residual: number
): { valor: number; depreciacao: number } {
  for (const valor of valores) {
    for (const depreciacao of depreciacoes) {
      if (Math.abs(valor - depreciacao - residual) <= TOL) return { valor, depreciacao };
    }
  }
  return { valor: valores[0], depreciacao: depreciacoes[0] };
}

// ── SCI Ambiente Contábil · "Correção e depreciação" ─────────────────────────

const RE_SCI_TITULO =
  /Corre[çc][ãa]o e deprecia[çc][ãa]o de (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/i;
/** "Conta: 102 - 01.2.3.01.005 - Veículos" (a classificação pode faltar). */
const RE_SCI_CONTA = /^Conta:\s*(\d+)\s*-\s*(?:(\d+(?:\.\d+)+)\s*-\s*)?(.+?)\s*$/;
/** "19 - 10/03/2025 - SEMIRREBOQUE PORTA CONTAINER ... 40 PES - " */
const RE_SCI_BEM = /^(\d+)\s*-\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(.*?)[\s-]*$/;
const RE_SCI_TOTAL_CONTA = /^Total geral da conta:\s*(\d+)\b/i;
const RE_SCI_TOTAL_GERAL = /^TOTAL GERAL DO RELAT/i;

type TipoMarco = "conta" | "bem" | "total-conta" | "total-geral";

interface Trecho {
  tipo: TipoMarco;
  m: RegExpMatchArray;
  corpo: string;
}

/**
 * Colunas do SCI numa linha de bem ou de total, na ordem em que o PDF desenha:
 * valor da depreciação, valor corrigido, residual, depreciação acumulada e do
 * período. Os valores "em moeda" (6 casas) e os meses ficam de fora.
 */
function colunasSci(d: number[]): {
  valores: number[];
  residual: number;
  depreciacoes: number[];
  resto: number[];
} | null {
  if (d.length < 5) return null;
  // Valor corrigido antes do valor da depreciação: é ele que o residual desconta.
  return { valores: [d[1], d[0]], residual: d[2], depreciacoes: [d[3], d[4]], resto: d.slice(5) };
}

function totaisSci(d: number[]): { total: TotaisBens | null; resto: number[] } {
  const c = colunasSci(d);
  if (!c) return { total: null, resto: [] };
  return { total: parQueFecha(c.valores, c.depreciacoes, c.residual), resto: c.resto };
}

/**
 * SCI Ambiente Contábil, relatório "Correção e depreciação". Cada bem ocupa um
 * bloco de várias linhas (cabeçalho "código - data - descrição", fornecedor,
 * documento e duas linhas de colunas), agrupado por conta contábil com o total
 * da conta no fim do grupo. Lido em `raw`: no `layout` os valores de um bem
 * aparecem acima do cabeçalho dele.
 *
 * Duas pegadinhas da ordem de desenho:
 *  - "Valor moeda: 0,21" vem ANTES de "Saldo em quantidade" no bloco do bem, e
 *    tem cara de dinheiro — por isso as colunas só contam depois do saldo;
 *  - o total geral do relatório é desenhado ANTES do rótulo "TOTAL GERAL DO
 *    RELATÓRIO", colado no total da última conta.
 */
export const sciCorrecaoDepreciacao: LeitorPatrimonial = {
  sistema: "SCI",
  relatorio: "Correção e depreciação",
  modo: "raw",
  reconhece: (t) => RE_SCI_TITULO.test(t) && /Dep\.\s*acumulada/i.test(t),

  ler(texto) {
    const trechos: Trecho[] = [];
    for (const bruta of texto.split(/\r?\n|\f/)) {
      const linha = bruta.trim();
      if (!linha) continue;
      const marco: [TipoMarco, RegExpMatchArray | null][] = [
        ["conta", linha.match(RE_SCI_CONTA)],
        ["total-conta", linha.match(RE_SCI_TOTAL_CONTA)],
        ["total-geral", linha.match(RE_SCI_TOTAL_GERAL)],
        ["bem", linha.match(RE_SCI_BEM)],
      ];
      const achado = marco.find(([, m]) => m);
      if (achado) {
        trechos.push({ tipo: achado[0], m: achado[1] as RegExpMatchArray, corpo: "" });
      } else if (trechos.length) {
        trechos[trechos.length - 1].corpo += `${linha}\n`;
      }
    }

    const contas: ContaBens[] = [];
    const bens: BemLido[] = [];
    let totalGeral: TotaisBens | null = null;

    for (const t of trechos) {
      if (t.tipo === "conta") {
        contas.push({ chave: t.m[1], classif: t.m[2], descricao: t.m[3], total: null });
        continue;
      }

      if (t.tipo === "total-conta") {
        const { total, resto } = totaisSci(dinheiros(t.corpo));
        const conta = contas.find((c) => c.chave === t.m[1]);
        if (conta) conta.total = total;
        // Total geral desenhado antes do próprio rótulo (ver acima).
        const geral = totaisSci(resto).total;
        if (geral) totalGeral = geral;
        continue;
      }

      if (t.tipo === "total-geral") {
        // Se um dia o total vier depois do rótulo, ele está aqui.
        const { total } = totaisSci(dinheiros(t.corpo));
        if (total) totalGeral = total;
        continue;
      }

      // Bem: sem conta aberta antes, não há onde pendurar.
      const conta = contas[contas.length - 1];
      if (!conta) continue;
      const saldo = t.corpo.match(/Saldo em quantidade:\s*[\d.,]*/i);
      const colunas = saldo ? t.corpo.slice((saldo.index ?? 0) + saldo[0].length) : t.corpo;
      const c = colunasSci(dinheiros(colunas.replace(/Valor moeda:\s*[\d.,]+/gi, "")));
      if (!c) continue;
      const { valor, depreciacao } = parQueFecha(c.valores, c.depreciacoes, c.residual);
      const taxa = colunas.match(RE_TAXA);
      bens.push({
        codigo: t.m[1],
        conta: conta.chave,
        descricao: t.m[3].replace(/\s+/g, " ").trim(),
        aquisicao: isoDeBR(t.m[2]),
        valor,
        depreciacao,
        taxa: taxa ? valorBR(taxa[1]) : 0,
        quantidade: 1,
        residual: c.residual,
      });
    }

    const titulo = texto.match(RE_SCI_TITULO);
    return {
      sistema: "SCI",
      posicao: titulo ? isoDeBR(titulo[2]) : null,
      // Conta sem bem nenhum (só cabeçalho) não tem o que implantar.
      contas: contas.filter((c) => bens.some((b) => b.conta === c.chave)),
      bens,
      totalGeral,
    };
  },
};

/** Ordem importa: o primeiro que reconhecer assume. */
export const LEITORES_PATRIMONIAL: LeitorPatrimonial[] = [sciCorrecaoDepreciacao];

/** "SCI (Correção e depreciação)", um por leitor — o que a tela e o erro listam. */
export const RELATORIOS_PATRIMONIAL = LEITORES_PATRIMONIAL.map(
  (l) => `${l.sistema} (${l.relatorio})`
);
