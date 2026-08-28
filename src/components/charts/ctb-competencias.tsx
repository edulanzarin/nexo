"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import { FAIXAS_ATRASO, type CtbCompetencia } from "@/lib/contabil-atraso-tipos";
import { faixaDe } from "@/lib/contabil-prod-escala";
import { mesBR, num, numCompact } from "@/lib/format";

function TooltipCompet({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CtbCompetencia }[];
}) {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  const faixa = FAIXAS_ATRASO[faixaDe(FAIXAS_ATRASO, c.mediana ?? 0)];
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">Competência {mesBR(c.compet + "-01")}</p>
      <TooltipLinha cor={faixa.cor} nome="Lançamentos" valor={num(c.qtd)} />
      <TooltipLinha nome="Atraso mediano" valor={c.mediana == null ? "—" : `${num(c.mediana)} dias`} />
      <TooltipLinha nome="Pessoas" valor={num(c.pessoas)} />
    </TooltipContainer>
  );
}

/**
 * Em que MÊS DO FATO o trabalho do período caiu. A barra é o volume; a cor é o
 * atraso mediano daquela competência, na escada da própria aba.
 *
 * É o gráfico que responde "o time está no mês corrente ou correndo atrás?" numa
 * olhada: barra alta e verde à direita é escrituração em dia; massa vermelha à
 * esquerda é passivo sendo pago.
 *
 * Eixo cronológico, sempre — ordenar por volume responderia outra pergunta.
 */
export function CtbCompetencias({
  dados,
  carregando,
  recarregando,
}: {
  dados: CtbCompetencia[] | undefined;
  carregando: boolean;
  recarregando: boolean;
}) {
  // Um ano de competências já enche o eixo; o que é mais velho que isso vive na
  // tabela e na exportação, não aqui.
  const itens = dados ? dados.slice(-24) : [];

  return (
    <ChartCard
      titulo="Competências trabalhadas"
      subtitulo="Volume por mês do fato, colorido pelo atraso mediano daquele mês"
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-72"
    >
      {itens.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem lançamentos no período</p>
      ) : (
        <>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={itens} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
                <XAxis
                  dataKey="compet"
                  tickFormatter={(v: string) => mesBR(v + "-01")}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--baseline)" }}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tickFormatter={(v: number) => numCompact(v)}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<TooltipCompet />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="qtd" radius={[4, 4, 0, 0]} animationDuration={500}>
                  {itens.map((c) => (
                    <Cell
                      key={c.compet}
                      fill={FAIXAS_ATRASO[faixaDe(FAIXAS_ATRASO, c.mediana ?? 0)].cor}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {dados && dados.length > itens.length && (
            <p className="mt-3 text-xs text-muted">
              Mostrando as 24 competências mais recentes das {num(dados.length)} do período · o resto
              sai na exportação
            </p>
          )}
        </>
      )}
    </ChartCard>
  );
}
