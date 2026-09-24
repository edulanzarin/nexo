"use client";

import { BarraComposicao } from "@/componentes/primitivos/barra";
import { Dica } from "@/componentes/primitivos/dica";
import { num, pct } from "@/lib/format";
import type { ClasseInfo, PorClasseGen } from "@/lib/prod-tipos";

/**
 * De que é feito o total do período: a natureza do lançamento no Contábil, a
 * espécie da nota no Fiscal, o tipo de gesto no NaveX. Uma barra de composição
 * e, embaixo, cada classe com o número e o peso, na cor do catálogo do dado.
 *
 * Classe zerada listada em `ocultarVazio` some em vez de virar um zero que não
 * diz nada ("Outras origens" num mês em que tudo se classificou). As outras
 * ficam: zero em "Digitado" é afirmação.
 */
export function ComposicaoClasses({
  classes,
  porClasse,
  total,
  ocultarVazio = [],
}: {
  classes: ClasseInfo[];
  porClasse: PorClasseGen;
  total: number;
  ocultarVazio?: string[];
}) {
  const visiveis = classes.filter((c) => !(ocultarVazio.includes(c.id) && !porClasse[c.id]));
  if (total === 0)
    return <p className="py-6 text-center text-corpo text-apagado italic">Nada para compor no período.</p>;
  return (
    <div className="flex flex-col gap-4">
      <BarraComposicao
        className="h-3"
        partes={visiveis.map((c) => ({
          valor: porClasse[c.id] ?? 0,
          cor: c.cor,
          rotulo: `${c.rotulo}: ${num(porClasse[c.id] ?? 0)}`,
        }))}
      />
      <div className="grid gap-x-5 gap-y-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {visiveis.map((c) => {
          const n = porClasse[c.id] ?? 0;
          return (
            <div key={c.id} className="min-w-0">
              <Dica texto={c.descricao} className="max-w-full">
                <span className="flex min-w-0 items-center gap-1.5 text-pequeno text-apagado">
                  <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: c.cor }} />
                  <span className="truncate">{c.rotulo}</span>
                </span>
              </Dica>
              <p className="mt-0.5 flex items-baseline gap-2">
                <span className="nx-leitura text-titulo text-tinta">{num(n)}</span>
                <span className="num text-pequeno text-apagado">{pct((n / total) * 100)}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
