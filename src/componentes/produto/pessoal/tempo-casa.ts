import { decimal, num } from "@/lib/format";

/**
 * Tempo de casa por extenso curto: dias até um mês, meses até um ano, depois
 * anos e meses. Mês de 30 dias de propósito: é leitura de ordem de grandeza
 * ("uns três anos"), não cálculo trabalhista, e a data exata está na coluna
 * de admissão ao lado.
 *
 * Mora aqui, e não na tela do Contábil onde nasceu, porque o quadro de
 * funcionários do Contábil, a Rotatividade do DP e o RH leem a mesma folha.
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

/**
 * Média de tempo de casa em anos com uma casa ("2,3 anos"). É a leitura de
 * média, que precisa comparar períodos; o extenso de `tempoCasa` serve à pessoa.
 */
export function emAnos(dias: number | null): string {
  if (dias == null) return "—";
  const anos = decimal(dias / 365);
  return `${anos} ${anos === "1" ? "ano" : "anos"}`;
}

/**
 * Dias de casa de quem segue ativo, contados até hoje. A ficha do Questor só
 * traz a conta pronta para quem saiu; sem isto, o funcionário ativo aparecia
 * com tempo de casa em branco.
 */
export function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const inicio = Date.parse(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(inicio)) return null;
  return Math.max(0, Math.floor((Date.now() - inicio) / 86_400_000));
}
