"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CtbItem } from "@/lib/contabil-produtividade-tipos";
import { brl, num, numCompact } from "@/lib/format";
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";

/** Item já com a cor resolvida pelo chamador (a classe da origem, por exemplo). */
export interface BarraItem extends Omit<CtbItem, "valor"> {
  /** Valor movimentado; ausente quando o recorte não guarda valor (origem por
   *  pessoa) — aí o tooltip mostra só a quantidade, em vez de um R$ 0,00 falso. */
  valor?: number;
  cor?: string;
  /** Linha extra do tooltip (ex.: "3 pessoas"). */
  detalhe?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: BarraItem }[];
  corPadrao: string;
  rotuloEixo: string;
  rotuloQtd: string;
  formatarQtd: (v: number) => string;
}

function TooltipBarra({ active, payload, corPadrao, rotuloEixo, rotuloQtd, formatarQtd }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 max-w-72 text-xs font-medium text-ink">{p.nome}</p>
      <p className="mb-1 text-[11px] text-muted">{rotuloEixo}</p>
      <TooltipLinha cor={p.cor ?? corPadrao} nome={rotuloQtd} valor={formatarQtd(p.qtd)} />
      {p.valor != null && <TooltipLinha nome="Valor" valor={brl(p.valor)} />}
      {p.detalhe && <p className="mt-1 text-[11px] text-muted">{p.detalhe}</p>}
    </TooltipContainer>
  );
}

/**
 * Barras horizontais de um ranking do Contábil (origens, empresas). Horizontal
 * porque os rótulos são nomes longos de empresa — em barra vertical eles viram
 * "AGROP…". O clique é opcional (só a origem filtra a tela).
 *
 * O que a barra MEDE é do chamador: a maioria conta lançamentos, mas a aba
 * Atraso mede dias e a aba Tempo mede horas. Daí `rotuloQtd`/`formatarQtd` —
 * sem eles o tooltip dizia "Lançamentos: 137" para 137 dias de atraso.
 */
export function CtbProdBarras({
  titulo,
  subtitulo,
  dados,
  carregando,
  recarregando,
  rotuloEixo,
  rotuloQtd = "Lançamentos",
  formatarQtd,
  corPadrao = "var(--accent)",
  limite = 12,
  selecionado,
  onSelecionar,
  acao,
}: {
  titulo: string;
  subtitulo: string;
  dados: BarraItem[] | undefined;
  carregando: boolean;
  recarregando: boolean;
  rotuloEixo: string;
  /** O que a barra conta ("Lançamentos", "Dias de atraso", "Horas"). */
  rotuloQtd?: string;
  /** Formato da grandeza. Sem ele, o tooltip usa o número cheio e o rótulo da
   *  barra a forma compacta — que é o certo para contagem, mas erra em dia e
   *  hora, onde a unidade importa mais que a compactação. */
  formatarQtd?: (v: number) => string;
  corPadrao?: string;
  limite?: number;
  selecionado?: string | null;
  onSelecionar?: (chave: string | null) => void;
  acao?: React.ReactNode;
}) {
  const itens = dados?.slice(0, limite) ?? [];
  const formatarTooltip = formatarQtd ?? num;
  const formatarRotulo = formatarQtd ?? numCompact;
  const altura = Math.max(160, itens.length * 30 + 24);

  return (
    <ChartCard
      titulo={titulo}
      subtitulo={subtitulo}
      acao={acao}
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-72"
    >
      {itens.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">Sem movimento no período</p>
      ) : (
        <div className="w-full" style={{ height: altura }}>
          <ResponsiveContainer>
            <BarChart
              data={itens}
              layout="vertical"
              margin={{ top: 0, right: 44, left: 0, bottom: 0 }}
              barCategoryGap={6}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nome"
                width={150}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)}
              />
              <Tooltip
                content={
                  <TooltipBarra
                    corPadrao={corPadrao}
                    rotuloEixo={rotuloEixo}
                    rotuloQtd={rotuloQtd}
                    formatarQtd={formatarTooltip}
                  />
                }
                cursor={{ fill: "var(--surface-2)" }}
              />
              <Bar
                dataKey="qtd"
                radius={[0, 4, 4, 0]}
                animationDuration={500}
                onClick={(d: unknown) => {
                  if (!onSelecionar) return;
                  const item = d as BarraItem;
                  onSelecionar(selecionado === item.chave ? null : item.chave);
                }}
                className={onSelecionar ? "cursor-pointer" : undefined}
              >
                {itens.map((it) => (
                  <Cell
                    key={it.chave}
                    fill={it.cor ?? corPadrao}
                    fillOpacity={selecionado && selecionado !== it.chave ? 0.35 : 1}
                  />
                ))}
                <LabelList
                  dataKey="qtd"
                  position="right"
                  formatter={(v) => formatarRotulo(v as number)}
                  style={{ fill: "var(--ink-2)", fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
