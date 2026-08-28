import type { ProdDia } from "./prod-tipos";

/**
 * Formatadores das abas de Produtividade (Contábil e Fiscal). Dez telas mostram
 * as mesmas grandezas — percentual, dias, horas — e um formatador por tela é
 * como a mesma porcentagem sai com uma casa numa aba e três na outra.
 *
 * Tudo em pt-BR e por `toLocaleString`: `toFixed` devolve PONTO, e em português
 * ponto é separador de milhar — ver [[Ponto decimal em interface pt-BR afirma
 * outro número]].
 */

/** Percentual já calculado, com uma casa: `12,4`. Sem o símbolo. */
export const pctBR = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Parte sobre total, em porcentagem. Total zero devolve 0, não NaN. */
export const pctDe = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

/** Quantidade de dias, com a unidade. `null` (sem amostra) vira travessão. */
export const emDias = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR")} d`;

/** Horas com uma casa: `38,5 h`. */
export const emHoras = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

/** Nome vira pedaço de nome de arquivo: sem acento, sem espaço. */
export function slug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** O dia de maior movimento de uma série esparsa (o pico do calendário). */
export function pico(celulas: ProdDia[]): ProdDia | null {
  let melhor: ProdDia | null = null;
  for (const c of celulas) if (!melhor || c.n > melhor.n) melhor = c;
  return melhor;
}
