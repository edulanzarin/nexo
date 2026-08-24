"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CLASSES, type CtbSeriePonto } from "@/lib/contabil-produtividade-tipos";
import { dataBR, mesBR, num, numCompact } from "@/lib/format";
import { ChartCard, LegendaSeries, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload: CtbSeriePonto }[];
  granularidade: "dia" | "mes";
  soTotal: boolean;
}

function TooltipSerie({ active, label, payload, granularidade, soTotal }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">
        {granularidade === "mes" ? mesBR(label) : dataBR(label)}
      </p>
      {!soTotal &&
        CLASSES.filter((c) => p[c.id] > 0).map((c) => (
          <TooltipLinha key={c.id} cor={c.cor} nome={c.rotulo} valor={num(p[c.id])} />
        ))}
      <TooltipLinha
        cor={soTotal ? "var(--accent)" : undefined}
        nome="Lançamentos"
        valor={num(p.total)}
      />
    </TooltipContainer>
  );
}

/**
 * Ritmo no período, empilhado por natureza do lançamento — a pergunta é "esse
 * pico foi trabalho ou integração?", e o total sozinho não responde.
 *
 * `soTotal` desenha uma área única: é o modo de quando UMA pessoa está isolada,
 * porque a quebra dia × natureza por pessoa não vem do servidor (seria um cubo
 * no payload). Preferimos a área única a ratear a natureza pela proporção do
 * período — o rateio desenharia uma distribuição que o dado não sustenta.
 */
export function CtbProdSerie({
  dados,
  granularidade,
  titulo = "Ritmo no período",
  subtitulo,
  soTotal = false,
  carregando,
  recarregando,
}: {
  dados: CtbSeriePonto[] | undefined;
  granularidade: "dia" | "mes";
  titulo?: string;
  subtitulo?: string;
  soTotal?: boolean;
  carregando: boolean;
  recarregando: boolean;
}) {
  const visiveis = soTotal ? [] : CLASSES.filter((c) => dados?.some((p) => p[c.id] > 0));

  return (
    <ChartCard
      titulo={titulo}
      subtitulo={subtitulo ?? `Lançamentos por ${granularidade === "mes" ? "mês" : "dia"}, por natureza`}
      acao={
        soTotal ? undefined : (
          <LegendaSeries series={visiveis.map((c) => ({ nome: c.rotulo, cor: c.cor }))} />
        )
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
            <AreaChart data={dados ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="ctb-prod-total" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
                {CLASSES.map((c) => (
                  <linearGradient key={c.id} id={`ctb-prod-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.cor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={c.cor} stopOpacity={0.04} />
                  </linearGradient>
                ))}
              </defs>
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
                tickFormatter={(v: number) => numCompact(v)}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                allowDecimals={false}
              />
              <Tooltip
                content={<TooltipSerie granularidade={granularidade} soTotal={soTotal} />}
                cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
              />
              {soTotal && (
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#ctb-prod-total)"
                  animationDuration={500}
                />
              )}
              {visiveis.map((c) => (
                <Area
                  key={c.id}
                  type="monotone"
                  dataKey={c.id}
                  stackId="1"
                  stroke={c.cor}
                  strokeWidth={1.5}
                  fill={`url(#ctb-prod-${c.id})`}
                  animationDuration={500}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
