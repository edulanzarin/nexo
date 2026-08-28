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
import { CLASSES } from "@/lib/contabil-produtividade-tipos";
import type { ClasseInfo, SeriePontoGen } from "@/lib/prod-classes";
import { dataBR, mesBR, num, numCompact } from "@/lib/format";
import { ChartCard, LegendaSeries, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";

/** Contagem de uma classe no ponto — o índice do ponto também carrega o bucket. */
const qtd = (p: SeriePontoGen, id: string): number => (typeof p[id] === "number" ? p[id] : 0);

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload: SeriePontoGen }[];
  granularidade: "dia" | "mes";
  soTotal: boolean;
  classes: ClasseInfo[];
  rotuloItem: string;
}

function TooltipSerie({
  active,
  label,
  payload,
  granularidade,
  soTotal,
  classes,
  rotuloItem,
}: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">
        {granularidade === "mes" ? mesBR(label) : dataBR(label)}
      </p>
      {!soTotal &&
        classes
          .filter((c) => qtd(p, c.id) > 0)
          .map((c) => (
            <TooltipLinha key={c.id} cor={c.cor} nome={c.rotulo} valor={num(qtd(p, c.id))} />
          ))}
      <TooltipLinha
        cor={soTotal ? "var(--accent)" : undefined}
        nome={rotuloItem}
        valor={num(p.total)}
      />
    </TooltipContainer>
  );
}

/**
 * Ritmo no período, empilhado pela dimensão categórica do módulo — natureza do
 * lançamento no Contábil, espécie da nota no Fiscal. A pergunta é "esse pico foi
 * trabalho ou integração?", e o total sozinho não responde.
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
  classes = CLASSES,
  rotuloItem = "Lançamentos",
  carregando,
  recarregando,
}: {
  dados: SeriePontoGen[] | undefined;
  granularidade: "dia" | "mes";
  titulo?: string;
  subtitulo?: string;
  soTotal?: boolean;
  /** Catálogo do módulo. O default é o do Contábil, dono original do gráfico. */
  classes?: ClasseInfo[];
  /** Como se chama o que está sendo contado ("Lançamentos", "Notas"). */
  rotuloItem?: string;
  carregando: boolean;
  recarregando: boolean;
}) {
  const visiveis = soTotal ? [] : classes.filter((c) => dados?.some((p) => qtd(p, c.id) > 0));

  return (
    <ChartCard
      titulo={titulo}
      subtitulo={
        subtitulo ??
        `${rotuloItem} por ${granularidade === "mes" ? "mês" : "dia"}, por natureza`
      }
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
        <p className="grid h-40 place-items-center text-sm text-muted">
          Sem movimento no período
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <AreaChart data={dados ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="ctb-prod-total" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
                {classes.map((c) => (
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
                content={
                  <TooltipSerie
                    granularidade={granularidade}
                    soTotal={soTotal}
                    classes={classes}
                    rotuloItem={rotuloItem}
                  />
                }
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
