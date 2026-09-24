"use client";

import type { ReactNode } from "react";
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
import { CaixaGrafico, DicaGrafico } from "@/componentes/produto/graficos";
import { pct } from "@/lib/format";

/** Um ponto da curva: % das empresas (acumulado) contra % do movimento (acumulado). */
export interface PontoConcentracao {
  pctEmpresas: number;
  pctItens: number;
}

const EIXO = { fill: "var(--apagado)", fontSize: 11 };
const QUARTOS = [0, 25, 50, 75, 100];

/**
 * Curva de concentração da carteira: quanto do movimento cabe nas primeiras
 * empresas. Quanto mais a curva sobe cedo, mais o período dependeu de poucos
 * clientes.
 *
 * As duas marcas fixas (metade das empresas, 80% do movimento) dão a régua:
 * sem elas a curva é bonita e não afirma nada.
 */
export function CurvaConcentracao({
  pontos,
  titulo = "Concentração da carteira",
  descricao,
  rotuloItem = "Lançamentos",
  carregando,
}: {
  pontos: PontoConcentracao[] | undefined;
  titulo?: ReactNode;
  descricao?: ReactNode;
  /** O que se acumula, no plural ("Lançamentos", "Notas"). */
  rotuloItem?: string;
  carregando?: boolean;
}) {
  return (
    <CaixaGrafico
      titulo={titulo}
      descricao={descricao}
      altura={240}
      carregando={carregando || !pontos}
      vazio={pontos && pontos.length === 0 ? "Nenhuma empresa com movimento no período." : false}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos ?? []} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--linha)" />
          <XAxis
            type="number"
            dataKey="pctEmpresas"
            domain={[0, 100]}
            ticks={QUARTOS}
            tickFormatter={(v: number) => `${v}%`}
            tick={EIXO}
            tickLine={false}
            axisLine={{ stroke: "var(--linha-forte)" }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={QUARTOS}
            tickFormatter={(v: number) => `${v}%`}
            tick={EIXO}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "var(--linha-forte)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PontoConcentracao;
              return (
                <DicaGrafico
                  titulo={`Primeiros ${pct(p.pctEmpresas)} das empresas`}
                  linhas={[{ rotulo: `${rotuloItem} acumulados`, valor: pct(p.pctItens), cor: "var(--serie-1)" }]}
                />
              );
            }}
          />
          <ReferenceLine
            y={80}
            stroke="var(--linha-forte)"
            strokeDasharray="4 3"
            label={{ value: "80% do movimento", position: "insideBottomRight", fill: "var(--apagado)", fontSize: 11 }}
          />
          <ReferenceLine x={50} stroke="var(--linha-forte)" strokeDasharray="4 3" />
          <Area
            type="monotone"
            dataKey="pctItens"
            stroke="var(--serie-1)"
            strokeWidth={2}
            fill="var(--serie-1)"
            fillOpacity={0.16}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </CaixaGrafico>
  );
}
