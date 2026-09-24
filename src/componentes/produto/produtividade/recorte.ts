import { dataBR, mesBR } from "@/lib/format";
import type { ProdCalendario, ProdDia } from "@/lib/prod-tipos";

/**
 * O recorte por pessoa das abas de Produtividade, feito no cliente.
 *
 * Cada pessoa do ranking já chega com os próprios dias, horas, empresas e
 * origens: isolar alguém é reprojetar o que está na memória, sem nova ida ao
 * Questor. Estas funções são puras para que o Contábil, o Fiscal e o DP façam a
 * mesma conta do mesmo jeito.
 */

export type Granularidade = "dia" | "mes";

/** Dia "YYYY-MM-DD" vira a chave do bucket da série: o próprio dia, ou o 1º do mês. */
export const bucketDe = (dia: string, g: Granularidade) => (g === "mes" ? `${dia.slice(0, 7)}-01` : dia);

/** Rótulo curto do eixo: "14/08" por dia, "ago/26" por mês. */
export const rotuloBucket = (bucket: string, g: Granularidade) =>
  g === "mes" ? mesBR(bucket) : `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`;

/** Rótulo da dica, completo: "14/08/2026" ou "ago/26". */
export const rotuloBucketLongo = (bucket: string, g: Granularidade) =>
  g === "mes" ? mesBR(bucket) : dataBR(bucket);

/** "dia" ou "mês", para a frase que descreve a série. */
export const nomeGranularidade = (g: Granularidade) => (g === "mes" ? "mês" : "dia");

/**
 * Soma a série esparsa de uma pessoa nos buckets densos do time. Sai só o
 * TOTAL por bucket: a quebra dia × classe por pessoa não vem no payload (seria
 * um cubo), e ratear pela proporção do período desenharia uma distribuição que
 * o dado não sustenta. Por isso o gráfico de quem está isolado é de área única.
 */
export function totalPorBucket(
  serie: ProdDia[],
  buckets: string[],
  g: Granularidade
): { bucket: string; total: number }[] {
  const soma = new Map<string, number>();
  for (const d of serie) {
    const b = bucketDe(d.d, g);
    soma.set(b, (soma.get(b) ?? 0) + d.n);
  }
  return buckets.map((bucket) => ({ bucket, total: soma.get(bucket) ?? 0 }));
}

/** O dia de maior movimento de uma série esparsa. */
export function picoDe(celulas: ProdDia[]): ProdDia | null {
  let melhor: ProdDia | null = null;
  for (const c of celulas) if (!melhor || c.n > melhor.n) melhor = c;
  return melhor;
}

/** O calendário de uma pessoa, na mesma grade do calendário do time. */
export function calendarioDe(
  periodo: { inicio: string; fim: string },
  serie: ProdDia[],
  total: number
): ProdCalendario {
  return { inicio: periodo.inicio, fim: periodo.fim, celulas: serie, total, pico: picoDe(serie) };
}

/**
 * A grade do calendário vem ESPARSA (só dia com trabalho); o desenho precisa
 * de todos os dias do período, senão o calendário começa no primeiro dia com
 * movimento e esconde a semana parada do começo do mês.
 */
export function diasDoCalendario(c: ProdCalendario): { dia: string; valor: number }[] {
  const mapa = new Map(c.celulas.map((x) => [x.d, x.n]));
  const out: { dia: string; valor: number }[] = [];
  const fim = new Date(`${c.fim}T00:00:00Z`);
  for (const t = new Date(`${c.inicio}T00:00:00Z`); t <= fim; t.setUTCDate(t.getUTCDate() + 1)) {
    const dia = t.toISOString().slice(0, 10);
    out.push({ dia, valor: mapa.get(dia) ?? 0 });
  }
  return out;
}

/** Fora do horário comercial: antes das 7h e a partir das 19h. */
export const foraDoExpediente = (hora: number) => hora < 7 || hora >= 19;

/** "07h" a partir do índice 0–23. */
export const rotuloHora = (hora: number) => `${String(hora).padStart(2, "0")}h`;
