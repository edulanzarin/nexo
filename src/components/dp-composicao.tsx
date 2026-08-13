"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DpColaborador, DpTipo } from "@/lib/dp-tipos";
import { DP_TIPOS } from "@/lib/dp-tipos";
import { num } from "@/lib/format";
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";

type Cores = Record<DpTipo, string>;

/* ── Composição: quanto de cada trabalho no período (donut) ─────────────────── */

interface DonutProps {
  totais: Record<DpTipo, number> | undefined;
  cores: Cores;
  carregando: boolean;
  recarregando: boolean;
}

export function DpComposicaoDonut({ totais, cores, carregando, recarregando }: DonutProps) {
  const fatias = DP_TIPOS.map((t) => ({
    id: t.id,
    rotulo: t.rotulo,
    valor: totais?.[t.id] ?? 0,
    cor: cores[t.id],
  }));
  const total = fatias.reduce((a, f) => a + f.valor, 0);

  return (
    <ChartCard
      titulo="Composição do trabalho"
      carregando={carregando || !totais}
      recarregando={recarregando}
      alturaSkeleton="h-72"
    >
      {total === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem registros no período</p>
      ) : (
        <div className="flex h-72 items-center gap-4">
          <div className="h-full min-w-0 flex-1">
            <ResponsiveContainer>
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof fatias)[number];
                    return (
                      <TooltipContainer>
                        <TooltipLinha cor={p.cor} nome={p.rotulo} valor={num(p.valor)} />
                      </TooltipContainer>
                    );
                  }}
                />
                <Pie
                  data={fatias}
                  dataKey="valor"
                  nameKey="rotulo"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={1.5}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  animationDuration={500}
                >
                  {fatias.map((f) => (
                    <Cell key={f.id} fill={f.cor} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-40 shrink-0 space-y-2.5">
            {fatias.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
                <span className="min-w-0 flex-1 truncate text-ink-2">{f.rotulo}</span>
                <span className="tnum text-right leading-tight">
                  <span className="block font-medium text-ink">{num(f.valor)}</span>
                  <span className="text-muted">
                    {total > 0
                      ? `${((f.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

/* ── Top colaboradores, barra empilhada pelos 4 trabalhos ───────────────────── */

interface StackProps {
  dados: DpColaborador[] | undefined;
  cores: Cores;
  carregando: boolean;
  recarregando: boolean;
  selecionado: number | null;
  onSelecionar: (codigo: number | null) => void;
  limite?: number;
}

export function DpColaboradorStack({
  dados,
  cores,
  carregando,
  recarregando,
  selecionado,
  onSelecionar,
  limite = 12,
}: StackProps) {
  const top = dados
    ? [...dados].sort((a, b) => b.total - a.total).slice(0, limite)
    : undefined;
  const altura = Math.max(220, (top?.length ?? 8) * 34);

  return (
    <ChartCard
      titulo="Top colaboradores por trabalho"
      carregando={carregando || !top}
      recarregando={recarregando}
      alturaSkeleton="h-80"
      acao={
        <div className="flex flex-wrap items-center gap-3">
          {DP_TIPOS.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: cores[t.id] }} />
              {t.rotulo}
            </span>
          ))}
        </div>
      }
    >
      {top && top.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem registros no período</p>
      ) : (
        <div style={{ height: altura }} className="w-full">
          <ResponsiveContainer>
            <BarChart
              data={top ?? []}
              layout="vertical"
              margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              barCategoryGap={8}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nome"
                width={180}
                tick={{ fill: "var(--ink-2)", fontSize: 11 }}
                tickFormatter={(v: string) => (v.length > 26 ? v.slice(0, 25) + "…" : v)}
                axisLine={{ stroke: "var(--baseline)" }}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const c = payload[0].payload as DpColaborador;
                  return (
                    <TooltipContainer>
                      <p className="mb-1 max-w-72 text-xs font-medium text-ink">{c.nome}</p>
                      {DP_TIPOS.map((t) => (
                        <TooltipLinha key={t.id} cor={cores[t.id]} nome={t.rotulo} valor={num(c[t.id])} />
                      ))}
                      <p className="mt-1 border-t border-hairline pt-1 text-[11px] text-muted">
                        {num(c.total)} no total
                      </p>
                    </TooltipContainer>
                  );
                }}
              />
              {DP_TIPOS.map((t, i) => (
                <Bar
                  key={t.id}
                  dataKey={t.id}
                  stackId="trab"
                  fill={cores[t.id]}
                  maxBarSize={20}
                  radius={i === DP_TIPOS.length - 1 ? [0, 4, 4, 0] : undefined}
                  animationDuration={500}
                  onClick={(d: unknown) => {
                    const cod = (d as DpColaborador).codigo;
                    onSelecionar(cod === selecionado ? null : cod);
                  }}
                  className="cursor-pointer"
                >
                  {(top ?? []).map((c) => (
                    <Cell
                      key={c.codigo}
                      fillOpacity={selecionado == null || selecionado === c.codigo ? 1 : 0.3}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
