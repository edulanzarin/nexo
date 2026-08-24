"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num, numCompact } from "@/lib/format";
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";

interface Ponto {
  hora: number;
  qtd: number;
}

function TooltipHora({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">
        {String(p.hora).padStart(2, "0")}h — {String(p.hora).padStart(2, "0")}:59
      </p>
      <TooltipLinha cor="var(--accent)" nome="Lançamentos" valor={num(p.qtd)} />
    </TooltipContainer>
  );
}

/** Fora do horário comercial: antes das 7h e a partir das 19h. */
const foraDoExpediente = (h: number) => h < 7 || h >= 19;

/**
 * Quando o trabalho acontece, por hora do dia. Serve para ver hábito e horário
 * incomum (madrugada, fim de expediente) — sinal de rotina automática rodando
 * fora de hora ou de gente virando a noite no fechamento.
 */
export function CtbProdHoras({
  dados,
  carregando,
  recarregando,
  subtitulo,
}: {
  dados: number[] | undefined;
  carregando: boolean;
  recarregando: boolean;
  subtitulo: string;
}) {
  const pontos: Ponto[] = (dados ?? []).map((qtd, hora) => ({ hora, qtd }));
  const total = pontos.reduce((a, p) => a + p.qtd, 0);
  const fora = pontos.filter((p) => foraDoExpediente(p.hora)).reduce((a, p) => a + p.qtd, 0);

  return (
    <ChartCard
      titulo="Quando o time trabalha"
      subtitulo={subtitulo}
      acao={
        total > 0 ? (
          <p className="text-xs text-muted">
            <span className="tnum font-medium text-ink-2">
              {((fora / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>{" "}
            fora do horário comercial
          </p>
        ) : undefined
      }
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-48"
    >
      {total === 0 ? (
        <p className="grid h-32 place-items-center text-sm text-muted">Sem lançamentos no período</p>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer>
            <BarChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="hora"
                tickFormatter={(h: number) => String(h).padStart(2, "0")}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--baseline)" }}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tickFormatter={(v: number) => numCompact(v)}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip content={<TooltipHora />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="qtd" radius={[4, 4, 0, 0]} animationDuration={500}>
                {pontos.map((p) => (
                  <Cell
                    key={p.hora}
                    fill={foraDoExpediente(p.hora) ? "var(--warning)" : "var(--accent)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
