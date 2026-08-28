"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, LegendaSeries, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import type { CtbAtrasoPonto } from "@/lib/contabil-atraso-tipos";
import { dataBR, mesBR, num, numCompact } from "@/lib/format";

const dias = (v: number | null) => (v == null ? "—" : `${num(v)} d`);

function TooltipAtraso({
  active,
  label,
  payload,
  granularidade,
}: {
  active?: boolean;
  label?: string;
  payload?: { payload: CtbAtrasoPonto }[];
  granularidade: "dia" | "mes";
}) {
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">
        {granularidade === "mes" ? mesBR(label) : dataBR(label)}
      </p>
      <TooltipLinha cor="var(--accent)" nome="Atraso mediano" valor={dias(p.mediana)} />
      <TooltipLinha cor="var(--warning)" nome="9 em cada 10 até" valor={dias(p.p90)} />
      <TooltipLinha nome="Lançamentos" valor={num(p.total)} />
    </TooltipContainer>
  );
}

/**
 * Como o atraso andou no período: a mediana e o p90 em dias (linhas, eixo da
 * esquerda) sobre o volume de lançamentos (barras claras, eixo da direita).
 *
 * O volume entra atrás porque um dia de 30 lançamentos e um de 30 mil desenham a
 * mesma linha de mediana — sem o volume, um pico de atraso irrelevante parece um
 * problema. Dia sem lançamento nenhum não tem mediana e a linha corta ali, em
 * vez de ligar dois pontos por cima do vazio.
 */
export function CtbAtrasoSerie({
  dados,
  granularidade,
  carregando,
  recarregando,
}: {
  dados: CtbAtrasoPonto[] | undefined;
  granularidade: "dia" | "mes";
  carregando: boolean;
  recarregando: boolean;
}) {
  return (
    <ChartCard
      titulo="Atraso ao longo do período"
      subtitulo={`Dias entre o fato e o registro, por ${granularidade === "mes" ? "mês" : "dia"} de trabalho`}
      acao={
        <LegendaSeries
          series={[
            { nome: "Mediana", cor: "var(--accent)" },
            { nome: "p90", cor: "var(--warning)" },
          ]}
        />
      }
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-72"
    >
      {dados && dados.every((p) => p.total === 0) ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem lançamentos no período</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <ComposedChart data={dados ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v: string) =>
                  granularidade === "mes" ? mesBR(v) : dataBR(v).slice(0, 5)
                }
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--baseline)" }}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                yAxisId="dias"
                tickFormatter={(v: number) => `${numCompact(v)}d`}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <YAxis
                yAxisId="qtd"
                orientation="right"
                tickFormatter={(v: number) => numCompact(v)}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={<TooltipAtraso granularidade={granularidade} />}
                cursor={{ fill: "var(--surface-2)" }}
              />
              <Bar
                yAxisId="qtd"
                dataKey="total"
                fill="var(--surface-2)"
                radius={[3, 3, 0, 0]}
                animationDuration={500}
              />
              <Line
                yAxisId="dias"
                type="monotone"
                dataKey="mediana"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                animationDuration={500}
              />
              <Line
                yAxisId="dias"
                type="monotone"
                dataKey="p90"
                stroke="var(--warning)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls={false}
                animationDuration={500}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
