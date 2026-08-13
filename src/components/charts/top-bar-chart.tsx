"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metrica, TopItem } from "@/lib/types";
import { brl, brlCompact, num, numCompact } from "@/lib/format";
import { ChartCard, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import { Segmented } from "@/components/ui";

interface Props {
  titulo: string;
  subtituloEnt: string;
  subtituloSai: string;
  dados: TopItem[] | undefined;
  carregando: boolean;
  recarregando: boolean;
  tipo: "ent" | "sai";
  onTipo: (t: "ent" | "sai") => void;
  metrica: Metrica;
  /** Rótulo da linha de quantidade no tooltip (ex.: "Notas", "Itens", "Quantidade"). */
  rotuloQtd?: string;
  /** Quando true, a quantidade é física (KG, UN…) e pode ter casas decimais. */
  qtdFisica?: boolean;
  /** Esconde o seletor Entradas/Saídas (rankings que não têm lado). */
  semSeletor?: boolean;
}

export function SeletorTipo({
  tipo,
  onTipo,
}: {
  tipo: "ent" | "sai";
  onTipo: (t: "ent" | "sai") => void;
}) {
  return (
    <Segmented
      value={tipo}
      onChange={onTipo}
      aria-label="Entradas ou saídas"
      options={[
        { value: "ent", label: "Entradas" },
        { value: "sai", label: "Saídas" },
      ]}
    />
  );
}

interface TooltipTopProps {
  active?: boolean;
  payload?: { payload: TopItem }[];
  cor: string;
  rotuloQtd: string;
  qtdFisica: boolean;
}

function TooltipTop({ active, payload, cor, rotuloQtd, qtdFisica }: TooltipTopProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const qtdFmt = qtdFisica
    ? p.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : num(p.qtd);
  return (
    <TooltipContainer>
      <p className="mb-1 max-w-72 text-xs font-medium text-ink">{p.nome}</p>
      {p.detalhe && <p className="mb-1 max-w-72 text-[11px] text-muted">{p.detalhe}</p>}
      <TooltipLinha cor={cor} nome="Valor" valor={brl(p.valor)} />
      <TooltipLinha nome={rotuloQtd} valor={qtdFmt} />
    </TooltipContainer>
  );
}

export function TopBarChart({
  titulo,
  subtituloEnt,
  subtituloSai,
  dados,
  carregando,
  recarregando,
  tipo,
  onTipo,
  metrica,
  rotuloQtd = "Notas",
  qtdFisica = false,
  semSeletor = false,
}: Props) {
  const cor = tipo === "ent" ? "var(--ent)" : "var(--sai)";
  const altura = Math.max(220, (dados?.length ?? 10) * 34);
  const chave = metrica === "valor" ? "valor" : "qtd";
  const rotulo =
    metrica === "valor"
      ? brlCompact
      : qtdFisica
        ? (v: number) => numCompact(v)
        : numCompact;

  return (
    <ChartCard
      titulo={titulo}
      subtitulo={tipo === "ent" ? subtituloEnt : subtituloSai}
      acao={semSeletor ? undefined : <SeletorTipo tipo={tipo} onTipo={onTipo} />}
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-80"
    >
      {dados && dados.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">
          Sem dados no período
        </p>
      ) : (
        <div style={{ height: altura }} className="w-full">
          <ResponsiveContainer>
            <BarChart
              data={dados ?? []}
              layout="vertical"
              margin={{ top: 0, right: 64, left: 0, bottom: 0 }}
              barCategoryGap={8}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nome"
                width={170}
                tick={{ fill: "var(--ink-2)", fontSize: 11 }}
                tickFormatter={(v: string) => (v.length > 24 ? v.slice(0, 23) + "…" : v)}
                axisLine={{ stroke: "var(--baseline)" }}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                content={<TooltipTop cor={cor} rotuloQtd={rotuloQtd} qtdFisica={qtdFisica} />}
                cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
              />
              <Bar
                dataKey={chave}
                maxBarSize={20}
                radius={[0, 4, 4, 0]}
                animationDuration={500}
              >
                {(dados ?? []).map((d, i) => (
                  <Cell key={`${d.codigo}-${i}`} fill={cor} />
                ))}
                <LabelList
                  dataKey={chave}
                  position="right"
                  formatter={(v) => rotulo(v as number)}
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
