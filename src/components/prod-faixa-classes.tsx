"use client";

import { StatTile } from "@/components/ui";
import { num, numCompact } from "@/lib/format";
import type { ClasseInfo, PorClasseGen } from "@/lib/prod-classes";

/**
 * A composição do período em poucos números, com o peso de cada um — a natureza
 * do lançamento no Contábil, a espécie da nota no Fiscal. Fica logo abaixo dos
 * KPIs porque responde "de que é feito esse total" antes de a pessoa rolar até
 * o gráfico.
 *
 * Classe zerada com `ocultarVazio` some em vez de virar um "0" que não diz nada
 * (é o caso de "Outras origens" num mês em que tudo se classificou).
 */
export function ProdFaixaClasses({
  classes,
  porClasse,
  total,
  ocultarVazio = [],
}: {
  classes: ClasseInfo[];
  porClasse: PorClasseGen;
  total: number;
  /** Ids que somem quando estão zerados. */
  ocultarVazio?: string[];
}) {
  const visiveis = classes.filter((c) => !(ocultarVazio.includes(c.id) && !porClasse[c.id]));
  return (
    <div
      className="grid grid-cols-2 gap-3"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(9rem, 1fr))` }}
    >
      {visiveis.map((c) => {
        const n = porClasse[c.id] ?? 0;
        const pct = total > 0 ? (n / total) * 100 : 0;
        return (
          <StatTile
            key={c.id}
            size="mini"
            as="cell"
            rotulo={c.rotulo}
            icon={
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: c.cor }}
                aria-hidden
              />
            }
            valor={numCompact(n)}
            valorCheio={num(n)}
            secundario={`${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% · ${c.descricao}`}
          />
        );
      })}
    </div>
  );
}
