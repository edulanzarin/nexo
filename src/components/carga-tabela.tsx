"use client";

import clsx from "clsx";
import type { TributosCargaEmpresa } from "@/lib/types";
import { brl, brlCompact } from "@/lib/format";

interface Props {
  dados: TributosCargaEmpresa[] | undefined;
  carregando: boolean;
  recarregando: boolean;
}

export function CargaTabela({ dados, carregando, recarregando }: Props) {
  const maxCarga = dados?.length ? Math.max(...dados.map((e) => e.carga)) : 0;

  return (
    <section className="card anim-fade-up p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold">Carga tributária por empresa</h2>
      </header>

      {carregando || !dados ? (
        <div className="skeleton h-80 w-full" />
      ) : dados.length === 0 ? (
        <p className="grid h-32 place-items-center text-sm text-muted">Sem dados no período</p>
      ) : (
        <div className={clsx("overflow-x-auto", recarregando && "refetching")}>
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="w-8 py-2 pr-2 text-right font-medium">#</th>
                <th className="py-2 pr-3 text-left font-medium">Empresa</th>
                <th className="py-2 pl-3 text-right font-medium">Faturamento</th>
                <th className="py-2 pl-3 text-right font-medium">Tributos</th>
                <th className="py-2 pl-3 text-right font-medium">Carga</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((e, i) => (
                <tr
                  key={e.codigo}
                  className="border-b border-hairline/60 last:border-0 hover:bg-surface-2/50"
                >
                  <td className="py-2.5 pr-2 text-right text-xs tabular-nums text-muted">{i + 1}</td>
                  <td className="max-w-[280px] truncate py-2.5 pr-3 font-medium text-ink" title={e.nome}>
                    {e.nome}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2" title={brl(e.faturamento)}>
                    {brlCompact(e.faturamento)}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2" title={brl(e.tributos)}>
                    {brlCompact(e.tributos)}
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:block">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${maxCarga > 0 ? (e.carga / maxCarga) * 100 : 0}%`,
                            background: "var(--esp-4)",
                          }}
                        />
                      </div>
                      <span className="w-12 text-right font-semibold tabular-nums text-ink">
                        {e.carga.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
