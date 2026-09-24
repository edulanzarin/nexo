import { num } from "@/lib/format";

/**
 * Tempo de casa por extenso curto: dias até um mês, meses até um ano, depois
 * anos e meses. Mês de 30 dias de propósito: é leitura de ordem de grandeza
 * ("uns três anos"), não cálculo trabalhista, e a data exata está na coluna
 * de admissão ao lado.
 */
export function tempoCasa(dias: number | null): string {
  if (dias == null) return "—";
  if (dias < 30) return `${num(dias)} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${num(meses)} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = `${num(anos)} ${anos === 1 ? "ano" : "anos"}`;
  return resto ? `${a} e ${num(resto)} ${resto === 1 ? "mês" : "meses"}` : a;
}
