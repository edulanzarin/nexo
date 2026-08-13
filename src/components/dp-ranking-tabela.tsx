"use client";

import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui";
import type { DpColaborador } from "@/lib/dp-tipos";
import { num } from "@/lib/format";

type Coluna = "total" | "avisos" | "rescisoes" | "admissoes" | "ferias";

const CABECALHOS: { key: Coluna; rotulo: string }[] = [
  { key: "total", rotulo: "Total" },
  { key: "avisos", rotulo: "Avisos" },
  { key: "rescisoes", rotulo: "Rescisões" },
  { key: "admissoes", rotulo: "Admissões" },
  { key: "ferias", rotulo: "Férias" },
];

interface Props {
  dados: DpColaborador[] | undefined;
  carregando: boolean;
  recarregando: boolean;
  /** codigousuario filtrado (destaca a linha) ou null. */
  selecionado: number | null;
  /** Clique numa linha alterna o filtro dos detalhes por aquele colaborador. */
  onSelecionar: (codigo: number | null) => void;
}

export function DpRankingTabela({ dados, carregando, recarregando, selecionado, onSelecionar }: Props) {
  const [ordenar, setOrdenar] = useState<Coluna>("total");

  const ordenados = useMemo(() => {
    if (!dados) return undefined;
    return [...dados].sort((a, b) => b[ordenar] - a[ordenar]);
  }, [dados, ordenar]);

  const maxTotal = useMemo(
    () => (ordenados?.length ? Math.max(...ordenados.map((c) => c.total)) : 0),
    [ordenados]
  );
  const totalGeral = useMemo(
    () => ordenados?.reduce((a, c) => a + c.total, 0) ?? 0,
    [ordenados]
  );

  return (
    <Card as="section">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Ranking de colaboradores do DP</h2>
        </div>
      </header>

      {carregando || !ordenados ? (
        <div className="skeleton h-96 w-full" />
      ) : ordenados.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">
          Nenhum trabalho lançado no período
        </p>
      ) : (
        <div
          className={clsx("max-h-[32rem] overflow-x-auto overflow-y-auto", recarregando && "refetching")}
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
                const pct = totalGeral > 0 ? (c.total / totalGeral) * 100 : 0;
                const larguraBarra = maxTotal > 0 ? (c.total / maxTotal) * 100 : 0;
                const sel = c.codigo === selecionado;
                return (
                  <tr
                    key={c.codigo}
                    onClick={() => onSelecionar(sel ? null : c.codigo)}
                    className={clsx(
                      "cursor-pointer border-b border-hairline/60 last:border-0 hover:bg-surface-2/50",
                      c.auto && "bg-surface-2/40",
                      sel && "bg-accent/8 hover:bg-accent/12"
                    )}
                  >
                    <td className="py-2.5 pr-2 text-right text-xs tabular-nums text-muted">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={clsx("font-medium", c.auto ? "text-ink-2" : "text-ink")}>
                          {c.nome}
                        </span>
                        {c.auto && (
                          <Badge tone="neutral" size="xs" uppercase>
                            automático
                          </Badge>
                        )}
                        {c.inativo && !c.auto && (
                          <Badge tone="critical" size="xs" uppercase>
                            inativo
                          </Badge>
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
                      <span className="font-semibold text-ink">{num(c.total)}</span>
                      <span className="ml-1 text-[11px] text-muted">
                        {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(c.avisos)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(c.rescisoes)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(c.admissoes)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(c.ferias)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
