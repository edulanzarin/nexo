"use client";

import { Card } from "@/components/ui";
import type { Faixa } from "@/lib/contabil-prod-escala";
import { num } from "@/lib/format";

const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);
const pctBR = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * A composição de uma escada ordinal em UMA barra: cada degrau é um pedaço, do
 * verde ao crítico, na ordem da escada. Abaixo, um degrau por célula com a
 * contagem e o peso.
 *
 * Barra empilhada em vez de barras lado a lado porque a pergunta é de proporção
 * ("quanto do mês foi trabalho atrasado?"), não de comparação entre degraus — e
 * a ordem aqui é fixa, então o olho lê a barra como uma régua.
 *
 * Faixa com zero continua desenhada na legenda: zero é afirmação, não ausência —
 * ver [[Zero na tela é afirmação, não valor de conforto]].
 */
export function CtbEscada({
  titulo,
  subtitulo,
  faixas,
  valores,
  rotuloItem,
  carregando,
}: {
  titulo: string;
  subtitulo: string;
  faixas: Faixa[];
  valores: number[] | undefined;
  rotuloItem: string;
  carregando: boolean;
}) {
  const total = valores?.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <Card as="section">
      <header className="mb-4">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>
      </header>

      {carregando || !valores ? (
        <div className="skeleton h-28 w-full" />
      ) : total === 0 ? (
        <p className="grid h-24 place-items-center text-sm text-muted">
          Nada para distribuir no período
        </p>
      ) : (
        <>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={`Distribuição de ${rotuloItem} por faixa`}
          >
            {faixas.map((f, i) => {
              const p = pct(valores[i] ?? 0, total);
              if (p <= 0) return null;
              return (
                <span
                  key={f.id}
                  title={`${f.rotulo}: ${num(valores[i])} (${pctBR(p)}%)`}
                  style={{ width: `${p}%`, background: f.cor }}
                />
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {faixas.map((f, i) => {
              const n = valores[i] ?? 0;
              return (
                <div
                  key={f.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-hairline p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: f.cor }}
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-ink-2">{f.rotulo}</p>
                  </div>
                  <p className="tnum text-xl leading-none font-semibold tracking-tight">{num(n)}</p>
                  <p className="text-[11px] text-muted">
                    {pctBR(pct(n, total))}% dos {rotuloItem}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
