"use client";

import clsx from "clsx";
import { Card } from "@/components/ui";
import { num } from "@/lib/format";

interface Item {
  rotulo: string;
  valor: number;
}

interface Props {
  titulo: string;
  subtitulo: string;
  dados: Item[] | undefined;
  /** Cor da barra (var CSS), ex.: "var(--critical)". */
  cor: string;
  /** Texto do estado vazio. */
  vazio: string;
  carregando: boolean;
  recarregando: boolean;
  /** Dimensão do drill (motivo, tempoCasa). Com ela e `onDrill`, cada barra
   *  vira clicável e abre as pessoas daquele recorte. */
  dim?: string;
  onDrill?: (dim: string, valor: string, rotulo: string) => void;
}

/**
 * Lista de barras horizontais rótulo → valor, com barra proporcional ao maior e
 * o % do total. Serve para qualquer quebra simples de contagem (motivo de
 * desligamento, tempo de casa). Sem lib de gráfico — é uma lista, não um plano.
 */
export function RotatividadeBarras({
  titulo,
  subtitulo,
  dados,
  cor,
  vazio,
  carregando,
  recarregando,
  dim,
  onDrill,
}: Props) {
  const total = dados?.reduce((a, d) => a + d.valor, 0) ?? 0;
  const max = dados?.reduce((a, d) => Math.max(a, d.valor), 0) ?? 0;
  const clicavel = !!(dim && onDrill);

  return (
    <Card as="section" className="flex flex-col">
      <header className="mb-4">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>}
      </header>

      {carregando || !dados ? (
        <div className="skeleton h-56 w-full" />
      ) : dados.length === 0 || total === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">{vazio}</p>
      ) : (
        <div className={clsx("flex flex-col gap-3", recarregando && "refetching")}>
          {dados.map((d) => {
            const largura = max > 0 ? (d.valor / max) * 100 : 0;
            const p = total > 0 ? (d.valor / total) * 100 : 0;
            return (
              <div
                key={d.rotulo}
                onClick={clicavel ? () => onDrill!(dim!, d.rotulo, d.rotulo) : undefined}
                className={clsx(
                  "rounded-md",
                  clicavel && "-mx-2 cursor-pointer px-2 py-1 transition-colors hover:bg-surface-2"
                )}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate text-ink" title={d.rotulo}>
                    {d.rotulo}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-2">
                    <span className="font-semibold text-ink">{num(d.valor)}</span>
                    <span className="ml-1 text-muted">
                      {p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${largura}%`, backgroundColor: cor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
