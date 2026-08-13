"use client";

import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import clsx from "clsx";
import type { ColaboradorProd } from "@/lib/types";
import { brl, brlCompact, num } from "@/lib/format";

type Coluna = "notas" | "notasEnt" | "notasSai" | "empresas" | "valor" | "canceladas";

interface Props {
  dados: ColaboradorProd[] | undefined;
  carregando: boolean;
  recarregando: boolean;
  /** Soma das notas das linhas visíveis — base do % de participação. */
  totalNotas: number;
}

const CABECALHOS: { key: Coluna; rotulo: string }[] = [
  { key: "notas", rotulo: "Notas" },
  { key: "notasEnt", rotulo: "Entradas" },
  { key: "notasSai", rotulo: "Saídas" },
  { key: "empresas", rotulo: "Empresas" },
  { key: "valor", rotulo: "Valor mov." },
  { key: "canceladas", rotulo: "Cancel." },
];

export function ProdutividadeTabela({ dados, carregando, recarregando, totalNotas }: Props) {
  const [ordenar, setOrdenar] = useState<Coluna>("notas");

  const ordenados = useMemo(() => {
    if (!dados) return undefined;
    return [...dados].sort((a, b) => b[ordenar] - a[ordenar]);
  }, [dados, ordenar]);

  const maxNotas = useMemo(
    () => (ordenados?.length ? Math.max(...ordenados.map((c) => c.notas)) : 0),
    [ordenados]
  );

  return (
    <section className="card anim-fade-up p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Ranking de colaboradores</h2>
        </div>
      </header>

      {carregando || !ordenados ? (
        <div className="skeleton h-96 w-full" />
      ) : ordenados.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem lançamentos no período</p>
      ) : (
        <div
          className={clsx("max-h-[32rem] overflow-y-auto overflow-x-auto", recarregando && "refetching")}
        >
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="w-8 py-2 pr-2 text-right font-medium">#</th>
                <th className="py-2 pr-3 text-left font-medium">Colaborador</th>
                {CABECALHOS.map((h) => {
                  const ativo = ordenar === h.key;
                  return (
                    <th key={h.key} className="py-2 pl-3 text-right font-medium">
                      <button
                        onClick={() => setOrdenar(h.key)}
                        className={clsx(
                          "inline-flex items-center gap-1 transition-colors hover:text-ink",
                          ativo && "text-ink"
                        )}
                      >
                        {h.rotulo}
                        <ArrowDown className={clsx("size-3", !ativo && "opacity-0")} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((c, i) => {
                const pct = totalNotas > 0 ? (c.notas / totalNotas) * 100 : 0;
                const larguraBarra = maxNotas > 0 ? (c.notas / maxNotas) * 100 : 0;
                return (
                  <tr
                    key={c.codigo}
                    className={clsx(
                      "border-b border-hairline/60 last:border-0 hover:bg-surface-2/50",
                      c.auto && "bg-surface-2/40"
                    )}
                  >
                    <td className="py-2.5 pr-2 text-right text-xs tabular-nums text-muted">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={clsx("font-medium", c.auto ? "text-ink-2" : "text-ink")}>
                          {c.nome}
                        </span>
                        {c.auto && (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                            automático
                          </span>
                        )}
                        {c.inativo && !c.auto && (
                          <span className="rounded bg-critical/12 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-critical">
                            inativo
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-1 w-full max-w-[260px] overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={clsx("h-full rounded-full", c.auto ? "bg-muted" : "bg-ent")}
                          style={{ width: `${larguraBarra}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">
                      <span className="font-semibold text-ink">{num(c.notas)}</span>
                      <span className="ml-1 text-[11px] text-muted">
                        {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(c.notasEnt)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(c.notasSai)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(c.empresas)}</td>
                    <td
                      className="py-2.5 pl-3 text-right tabular-nums text-ink-2"
                      title={brl(c.valor)}
                    >
                      {brlCompact(c.valor)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">
                      <span className={clsx(c.canceladas > 0 ? "text-critical" : "text-muted")}>
                        {num(c.canceladas)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
