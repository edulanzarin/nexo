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
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import { dataBR, mesBR, numCompact } from "@/lib/format";

export interface PontoSimples {
  bucket: string;
  valor: number;
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload: PontoSimples }[];
  granularidade: "dia" | "mes";
  rotulo: string;
  cor: string;
  formatar: (v: number) => string;
}

function TooltipSimples({ active, label, payload, granularidade, rotulo, cor, formatar }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">
        {granularidade === "mes" ? mesBR(label) : dataBR(label)}
      </p>
      <TooltipLinha cor={cor} nome={rotulo} valor={formatar(payload[0].payload.valor)} />
    </TooltipContainer>
  );
}

/**
 * Série de UMA grandeza no período — exclusões por dia, horas por dia. É a irmã
 * simples da série de Lançamentos, que empilha as naturezas: aqui não há
 * composição para mostrar, e uma área única não finge que há.
 *
 * Os buckets chegam DENSOS do servidor (dia sem movimento vem com zero), então o
 * vale no gráfico é vale de verdade, não furo de dado.
 */
export function CtbSerieSimples({
  titulo,
  subtitulo,
  dados,
  granularidade,
  rotulo,
  cor = "var(--accent)",
  formatar = (v) => numCompact(v),
  carregando,
  recarregando,
}: {
  titulo: string;
  subtitulo: string;
  dados: PontoSimples[] | undefined;
  granularidade: "dia" | "mes";
  rotulo: string;
  cor?: string;
  formatar?: (v: number) => string;
  carregando: boolean;
  recarregando: boolean;
}) {
  const id = `ctb-simples-${titulo.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <ChartCard
      titulo={titulo}
      subtitulo={subtitulo}
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-72"
    >
      {dados && dados.every((p) => p.valor === 0) ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem movimento no período</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={dados ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cor} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
                </linearGradient>
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
                tickFormatter={formatar}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={
                  <TooltipSimples
                    granularidade={granularidade}
                    rotulo={rotulo}
                    cor={cor}
                    formatar={formatar}
                  />
                }
                cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke={cor}
                strokeWidth={2}
                fill={`url(#${id})`}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
