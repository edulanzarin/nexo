"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Gauge, HandCoins, Plane, ShieldCheck, Users } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { ChartCard, LegendaSeries, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import { CardPendencia } from "@/components/painel-pendencia";
import { usePainelGestao } from "@/hooks/use-api";
import { dataBR, mesBR, num } from "@/lib/format";
import { linkEsocial, linkFerias, linkRescisoes } from "@/lib/painel-links";
import type { PainelGestao, PainelSeriePonto, PainelTrabalhos } from "@/lib/painel-dp-tipos";

/** KPI compacto de atividade, com comparação ao mês anterior. */
function KpiAtividade({ rotulo, valor, anterior }: { rotulo: string; valor: number; anterior: number }) {
  const delta = valor - anterior;
  return (
    <Card padding="md">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{num(valor)}</p>
      <p className="mt-0.5 text-[11px] text-muted">
        {delta === 0 ? (
          "igual ao mês anterior"
        ) : (
          <span className={delta > 0 ? "text-good" : "text-critical"}>
            {delta > 0 ? "▲" : "▼"} {num(Math.abs(delta))} vs mês anterior
          </span>
        )}
      </p>
    </Card>
  );
}

function TipSerie({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { payload: PainelSeriePonto }[];
}) {
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">{mesBR(label)}</p>
      <TooltipLinha cor="var(--good)" nome="Admissões" valor={num(p.admissoes)} />
      <TooltipLinha cor="var(--critical)" nome="Rescisões" valor={num(p.rescisoes)} />
      <TooltipLinha cor="var(--warning)" nome="Avisos" valor={num(p.avisos)} />
      <TooltipLinha cor="var(--esp-5)" nome="Férias" valor={num(p.ferias)} />
    </TooltipContainer>
  );
}

function SerieChart({ dados }: { dados: PainelSeriePonto[] }) {
  return (
    <ChartCard
      titulo="Atividade do DP nos últimos meses"
      subtitulo="Trabalhos calculados por mês (avisos, rescisões, admissões, férias)"
      acao={
        <LegendaSeries
          series={[
            { nome: "Admissões", cor: "var(--good)" },
            { nome: "Rescisões", cor: "var(--critical)" },
            { nome: "Avisos", cor: "var(--warning)" },
            { nome: "Férias", cor: "var(--esp-5)" },
          ]}
        />
      }
      carregando={false}
      recarregando={false}
      alturaSkeleton="h-72"
    >
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
            <XAxis
              dataKey="bucket"
              tickFormatter={mesBR}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={{ stroke: "var(--hairline)" }}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<TipSerie />} />
            <Bar dataKey="admissoes" stackId="t" fill="var(--good)" />
            <Bar dataKey="rescisoes" stackId="t" fill="var(--critical)" />
            <Bar dataKey="avisos" stackId="t" fill="var(--warning)" />
            <Bar dataKey="ferias" stackId="t" fill="var(--esp-5)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Top operadores do DP no mês — barras proporcionais (visão de gestor). */
function TopOperadores({ dados }: { dados: PainelGestao["atividade"] }) {
  const itens = dados?.topOperadores ?? [];
  const max = itens.reduce((m, o) => Math.max(m, o.total), 0) || 1;
  return (
    <Card as="section" padding="md" className="h-full">
      <div className="mb-3 flex items-center gap-2">
        <Users className="size-4 text-ink-2" />
        <h3 className="text-sm font-medium text-ink">Quem mais trabalhou no mês</h3>
      </div>
      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Sem movimento do DP no mês.</p>
      ) : (
        <ul className="space-y-2.5">
          {itens.map((o) => (
            <li key={o.nome}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-ink" title={o.nome}>
                  {o.nome}
                </span>
                <span className="shrink-0 font-medium text-ink-2">{num(o.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-ent" style={{ width: `${(o.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const TRAB_ROTULO: { chave: keyof PainelTrabalhos; rotulo: string }[] = [
  { chave: "admissoes", rotulo: "Admissões" },
  { chave: "rescisoes", rotulo: "Rescisões" },
  { chave: "avisos", rotulo: "Avisos prévios" },
  { chave: "ferias", rotulo: "Férias calculadas" },
];

export default function PainelGestaoPage() {
  const res = usePainelGestao();
  const dados = res.data;

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível carregar o painel"
        descricao={res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
      />
    );
  }

  if (!dados) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }

  const { rescisoes, ferias, esocial, atividade, serie } = dados;
  const hoje = dados.periodo.fim;

  return (
    <div className="space-y-6">
      {/* Pendências */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Pendências do DP</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CardPendencia
            titulo="Rescisões a pagar"
            icone={<HandCoins className="size-4" />}
            href={linkRescisoes(hoje)}
            indisponivel={!rescisoes}
            valor={rescisoes?.pendentes ?? 0}
            rotulo="pendentes"
            detalhe={rescisoes ? `${num(rescisoes.vencidas)} vencidas · ${num(rescisoes.venceBreve)} vencem em breve` : ""}
            tone={rescisoes && rescisoes.vencidas > 0 ? "critical" : rescisoes && rescisoes.pendentes > 0 ? "warning" : "good"}
          />
          <CardPendencia
            titulo="Férias vencidas"
            icone={<Plane className="size-4" />}
            href={linkFerias(hoje)}
            indisponivel={!ferias}
            valor={ferias?.vencidas ?? 0}
            rotulo="funcionários"
            detalhe={ferias ? `${num(ferias.aVencer)} a vencer (120 dias)` : ""}
            tone={ferias && ferias.vencidas > 0 ? "critical" : ferias && ferias.aVencer > 0 ? "warning" : "good"}
          />
          <CardPendencia
            titulo="eSocial rejeitado"
            icone={<ShieldCheck className="size-4" />}
            href={linkEsocial(hoje)}
            indisponivel={!esocial}
            valor={esocial?.rejeitados ?? 0}
            rotulo="rejeitadas (90d)"
            detalhe={esocial ? `${num(esocial.pendentes)} pendentes de recibo` : ""}
            tone={esocial && esocial.rejeitados > 0 ? "critical" : esocial && esocial.pendentes > 0 ? "warning" : "good"}
          />
        </div>
      </section>

      {/* Atividade do mês */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Gauge className="size-4 text-ink-2" />
          <h2 className="text-sm font-semibold text-ink">Atividade do mês</h2>
          <span className="text-xs text-muted">
            {dataBR(dados.periodo.inicio)} – {dataBR(dados.periodo.fim)}
            {atividade ? ` · ${num(atividade.colaboradores)} pessoas do DP` : ""}
          </span>
        </div>
        {atividade ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {TRAB_ROTULO.map((t) => (
              <KpiAtividade key={t.chave} rotulo={t.rotulo} valor={atividade.mes[t.chave]} anterior={atividade.anterior[t.chave]} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Atividade indisponível agora.</p>
        )}
      </section>

      {/* Série + top operadores */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {serie && serie.length > 0 ? (
            <SerieChart dados={serie} />
          ) : (
            <Card padding="md" className="grid h-full min-h-[18rem] place-items-center">
              <p className="text-sm text-muted">Série indisponível agora.</p>
            </Card>
          )}
        </div>
        <TopOperadores dados={atividade} />
      </section>
    </div>
  );
}
