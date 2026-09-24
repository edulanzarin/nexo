"use client";

import { Dica } from "@/componentes/primitivos/dica";
import { Icone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";
import { deltaPct, pct } from "@/lib/format";

/**
 * Quanto o número andou contra o período anterior de mesmo tamanho, dentro da
 * linha de detalhe do indicador. A cor diz se andou para o lado bom, e o lado
 * bom é de quem chama: mais lançamento é bom, mais exclusão não é.
 *
 * Sem período anterior (zero), não se desenha: "+∞%" não informa nada.
 */
export function Variacao({
  atual,
  anterior,
  bomQuandoSobe = true,
  className,
}: {
  atual: number;
  anterior: number;
  bomQuandoSobe?: boolean;
  className?: string;
}) {
  const v = deltaPct(atual, anterior);
  if (v == null) return null;
  const sobe = v > 0;
  const parado = Math.abs(v) < 0.05;
  const bom = sobe === bomQuandoSobe;
  return (
    <Dica texto="Contra o período anterior de mesmo tamanho">
      <span
        className={cn(
          "num inline-flex items-center gap-0.5 font-[600]",
          parado ? "text-apagado" : bom ? "text-ok" : "text-perigo",
          className
        )}
      >
        <Icone nome={parado ? "menos" : sobe ? "sobe-direita" : "desce-direita"} tamanho={14} />
        {pct(Math.abs(v))}
      </span>
    </Dica>
  );
}
