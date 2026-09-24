import { brl } from "@/lib/format";
import { TOLERANCIA, type ConferenciaConta } from "@/lib/patrimonial-conferencia";
import type { TotaisBens } from "@/lib/patrimonial-tipos";

/**
 * Onde a soma lida se afasta do total impresso, só no que difere: "valor
 * +R$ 120,00 · depreciação -R$ 4,10". Diferença dentro da tolerância de
 * arredondamento não aparece, senão todo relatório "diferiria" por centavo.
 */
export function diferenca(dif: TotaisBens): string {
  return [
    Math.abs(dif.valor) > TOLERANCIA ? `valor ${dif.valor > 0 ? "+" : ""}${brl(dif.valor)}` : null,
    Math.abs(dif.depreciacao) > TOLERANCIA
      ? `depreciação ${dif.depreciacao > 0 ? "+" : ""}${brl(dif.depreciacao)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A diferença de uma conta contra o relatório, quando há total para comparar. */
export function diferencaDaConta(conf: ConferenciaConta): string | null {
  if (!conf.relatorio) return null;
  return diferenca({
    valor: conf.lido.valor - conf.relatorio.valor,
    depreciacao: conf.lido.depreciacao - conf.relatorio.depreciacao,
  });
}
