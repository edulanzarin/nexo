import { montarAnaliticas, parseValor, type LinhaBruta } from "./implantacao-entrada";
import type { LinhaOrigem } from "./implantacao-tipos";

/**
 * Extrai as contas de um balancete em PDF. Trabalha sobre o texto de
 * `pdftotext -layout` (colunas preservadas por espaços) e é agnóstico ao
 * software de origem: em vez de um leitor por layout, usa a POSIÇÃO das colunas
 * que todo balancete compartilha — código na esquerda, saldo atual na direita.
 *
 * Regras da extração:
 *  - linha de conta = começa por um código e tem ao menos um valor;
 *  - o saldo de abertura é o ÚLTIMO valor da linha (a coluna "Saldo Atual" é a
 *    mais à direita nos dois layouts conhecidos — Systemar e Patrimonium);
 *  - a classificação hierárquica, quando existe, é a célula com pontos
 *    ("1.1.02.09"); ela guia o filtro de sintéticas.
 * O D/C do saldo (sufixo, parênteses ou sinal) e o descarte de sintéticas ficam
 * em `implantacao-entrada.ts`, valendo para qualquer origem.
 */

/** Célula de valor BR: "8.955.354,63D", "( 18.451,17)", "1,00". */
const RE_VALOR = /^\(?\s*[\d.]*\d,\d{2}\s*\)?[dc]?$/i;
/** Célula de código: só dígitos e pontos ("111111110001", "1.1.02.09"). */
const RE_CODIGO = /^\d[\d.]*$/;
/** Classificação hierárquica pontuada ("1.1.01.02.0008"). */
const RE_PONTUADA = /^\d+(\.\d+)+$/;

export function parsearBalancetePdf(texto: string): LinhaOrigem[] {
  const bruto: LinhaBruta[] = [];

  for (const linha of texto.split(/\r?\n/)) {
    // `-layout` separa colunas por 2+ espaços; dentro da célula o espaço é único.
    const celulas = linha
      .split(/\s{2,}/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (celulas.length < 2) continue;

    const valores = celulas.filter((c) => RE_VALOR.test(c));
    if (!valores.length) continue;
    const val = parseValor(valores[valores.length - 1]); // saldo atual = o último
    if (!val) continue;

    // A 1ª célula às vezes junta "código classificação" (o pdftotext só separou
    // colunas por 2+ espaços, e alguns balancetes deixam 1 espaço entre elas).
    const cabeca = celulas[0].split(/\s+/);
    const chave = cabeca[0];
    // Linha de conta começa por um código (descarta cabeçalho, empresa, rodapé).
    if (!RE_CODIGO.test(chave)) continue;

    // Classificação = célula/token pontuado; se o código já é pontuado (a linha
    // perdeu o código reduzido), ele mesmo é a classificação.
    let classif =
      cabeca.slice(1).find((t) => RE_PONTUADA.test(t)) ??
      celulas.slice(1).find((c) => RE_PONTUADA.test(c));
    if (!classif && RE_PONTUADA.test(chave)) classif = chave;

    const descricao =
      celulas
        .slice(1)
        .filter((c) => !RE_VALOR.test(c) && !RE_CODIGO.test(c))
        .join(" ")
        .trim() || chave;

    bruto.push({ chave, classif, descricao, saldo: val.saldo, natureza: val.natureza });
  }

  return montarAnaliticas(bruto);
}
