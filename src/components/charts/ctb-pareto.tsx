"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import type { CtbParetoPonto } from "@/lib/contabil-carteira-tipos";

const pctBR = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function TooltipPareto({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CtbParetoPonto }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">
        As {pctBR(p.pctEmpresas)} empresas com mais movimento
      </p>
      <TooltipLinha cor="var(--accent)" nome="Concentram" valor={pctBR(p.pctLancamentos)} />
    </TooltipContainer>
  );
}

/**
 * Curva de concentração da carteira: quanto do movimento cabe nas primeiras
 * empresas. A diagonal é a carteira perfeitamente plana — quanto mais a curva
 * se descola dela para cima, mais o mês dependeu de poucos clientes.
 *
 * As duas marcas fixas (50% das empresas, 80% do movimento) existem para dar
 * régua: sem elas a curva é bonita e não afirma nada.
 */
export function CtbPareto({
  dados,
  metadeEm,
  carregando,
  recarregando,
}: {
  dados: CtbParetoPonto[] | undefined;
  metadeEm: number;
  carregando: boolean;
  recarregando: boolean;
}) {
  return (
    <ChartCard
      titulo="Concentração da carteira"
      subtitulo={
        metadeEm > 0
          ? `Metade dos lançamentos do período saiu de ${metadeEm} empresa(s)`
          : "Quanto do movimento cabe nas empresas mais ativas"
      }
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-72"
    >
      {!dados || dados.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">
          Nenhuma empresa com movimento no período
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="ctb-pareto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
              <XAxis
                type="number"
                dataKey="pctEmpresas"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--baseline)" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<TooltipPareto />} cursor={{ stroke: "var(--baseline)" }} />
              <ReferenceLine
                y={80}
                stroke="var(--baseline)"
                strokeDasharray="4 3"
                label={{ value: "80% do movimento", position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }}
              />
              <ReferenceLine x={50} stroke="var(--baseline)" strokeDasharray="4 3" />
              <Area
                type="monotone"
                dataKey="pctLancamentos"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#ctb-pareto)"
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
