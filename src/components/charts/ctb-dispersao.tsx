"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import { num, numCompact } from "@/lib/format";

export interface PontoDispersao {
  codigo: number;
  nome: string;
  horas: number;
  /** O que saiu daquelas horas. Nome neutro: lançamentos no Contábil, notas no
   *  Fiscal — o rótulo entra por prop, o campo é o mesmo. */
  itens: number;
}

const h1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

function TooltipDisp({
  active,
  payload,
  rotuloItem,
}: {
  active?: boolean;
  payload?: { payload: PontoDispersao }[];
  rotuloItem: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">{p.nome}</p>
      <TooltipLinha cor="var(--accent)" nome="Horas no Questor" valor={h1(p.horas)} />
      <TooltipLinha nome={rotuloItem} valor={num(p.itens)} />
      <TooltipLinha
        nome="Por hora"
        valor={p.horas > 0 ? num(Math.round(p.itens / p.horas)) : "—"}
      />
    </TooltipContainer>
  );
}

/**
 * Horas × o que saiu delas, uma bolha por pessoa. Não é placar: quem passa o mês
 * em conferência e conciliação aparece embaixo à direita com todo o direito — o
 * lançamento é só uma das coisas que se faz dentro do Questor.
 *
 * O que o gráfico serve é a DISPERSÃO: duas pessoas com a mesma carga horária em
 * pontos opostos do eixo vertical são uma pergunta que vale fazer.
 */
export function CtbDispersao({
  dados,
  carregando,
  recarregando,
  rotuloItem = "Lançamentos",
}: {
  dados: PontoDispersao[] | undefined;
  carregando: boolean;
  recarregando: boolean;
  rotuloItem?: string;
}) {
  return (
    <ChartCard
      titulo={`Horas × ${rotuloItem.toLowerCase()}`}
      subtitulo="Uma bolha por pessoa — o eixo horizontal é o tempo no sistema, o vertical é o que saiu dele"
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-72"
    >
      {!dados || dados.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem tempo registrado no período</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--grid)" strokeWidth={1} />
              <XAxis
                type="number"
                dataKey="horas"
                name="Horas"
                tickFormatter={(v: number) => `${numCompact(v)}h`}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--baseline)" }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="itens"
                name={rotuloItem}
                tickFormatter={(v: number) => numCompact(v)}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                content={<TooltipDisp rotuloItem={rotuloItem} />}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter
                data={dados}
                fill="var(--accent)"
                fillOpacity={0.65}
                animationDuration={500}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
