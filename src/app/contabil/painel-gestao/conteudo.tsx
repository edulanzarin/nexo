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
import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  FileSpreadsheet,
  Import,
  Landmark,
  ListChecks,
  ScanSearch,
  Table2,
} from "lucide-react";
import { Kpi } from "@/components/kpi-conf";
import { Card, EmptyState } from "@/components/ui";
import { ChartCard, LegendaSeries, TooltipContainer, TooltipLinha } from "@/components/ui/chart-card";
import { usePainelContabilGestao } from "@/hooks/use-api";
import { dataBR, dataHoraBR, mesBR, num } from "@/lib/format";
import type { ContabilSeriePonto } from "@/lib/painel-contabil-tipos";

/** acao da trilha → rótulo legível no feed. */
const ROTULO_ACAO: Record<string, string> = {
  "contabil.conciliacao.gerar": "Conciliação gerada",
  "contabil.implantacao.gerar": "Implantação gerada",
  "contabil.laudo.gerar": "Laudo gerado",
  "contabil.pendencia.triar": "Pendência triada",
  "contabil.export": "Exportação",
};

function TipSerie({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { payload: ContabilSeriePonto }[];
}) {
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <TooltipContainer>
      <p className="mb-1 text-xs font-medium text-ink">{mesBR(label)}</p>
      <TooltipLinha cor="var(--accent)" nome="Conciliações" valor={num(p.conciliacoes)} />
      <TooltipLinha cor="var(--good)" nome="Implantações" valor={num(p.implantacoes)} />
      <TooltipLinha cor="var(--esp-5)" nome="Laudos" valor={num(p.laudos)} />
    </TooltipContainer>
  );
}

function SerieChart({ dados }: { dados: ContabilSeriePonto[] }) {
  return (
    <ChartCard
      titulo="O que o time rodou nos últimos meses"
      subtitulo="Conciliações, implantações e laudos gerados por mês"
      acao={
        <LegendaSeries
          series={[
            { nome: "Conciliações", cor: "var(--accent)" },
            { nome: "Implantações", cor: "var(--good)" },
            { nome: "Laudos", cor: "var(--esp-5)" },
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
            <Bar dataKey="conciliacoes" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="implantacoes" fill="var(--good)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="laudos" fill="var(--esp-5)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export default function PainelContabilGestaoPage() {
  const res = usePainelContabilGestao();
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }

  const { atividade, base, serie, recentes } = dados;

  return (
    <div className="space-y-6">
      {/* Atividade do mês */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">Atividade do time no mês</h2>
          <span className="text-xs text-muted">
            {dataBR(dados.periodo.inicio)} – {dataBR(dados.periodo.fim)}
          </span>
        </div>
        {atividade ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              rotulo="Conciliações geradas"
              icone={<Landmark className="size-4" />}
              corIcone="bg-accent/12 text-accent"
              valor={num(atividade.conciliacoes)}
              secundario={`${num(atividade.conciliacaoLinhas)} lançamentos gerados`}
            />
            <Kpi
              rotulo="Implantações geradas"
              icone={<Import className="size-4" />}
              corIcone="bg-good/12 text-good"
              valor={num(atividade.implantacoes)}
              secundario="Arquivos de saldo gerados"
            />
            <Kpi
              rotulo="Laudos gerados"
              icone={<FileSpreadsheet className="size-4" />}
              corIcone="bg-ent/12 text-ent"
              valor={num(atividade.laudos)}
              secundario="Análises de balancete"
            />
            <Kpi
              rotulo="Pendências triadas"
              icone={<ListChecks className="size-4" />}
              corIcone="bg-warning/12 text-warning"
              valor={num(atividade.pendenciasTriadas)}
              secundario={`${num(atividade.pendenciasResolvidas)} resolvidas · ${num(atividade.pendenciasIgnoradas)} ignoradas`}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Atividade indisponível agora.</p>
        )}
      </section>

      {/* Base configurada */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Base configurada</h2>
        {base ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              rotulo="Plano de contabilização"
              icone={<Table2 className="size-4" />}
              corIcone="bg-ent/12 text-ent"
              valor={num(base.plano)}
              secundario="CFOPs com regra"
            />
            <Kpi
              rotulo="Regras de extrato"
              icone={<ScanSearch className="size-4" />}
              corIcone="bg-accent/12 text-accent"
              valor={num(base.regrasExtrato)}
              secundario="Contrapartidas do extrato"
            />
            <Kpi
              rotulo="Contas de banco"
              icone={<Banknote className="size-4" />}
              corIcone="bg-good/12 text-good"
              valor={num(base.contasBanco)}
              secundario="Contas mapeadas"
            />
            <Kpi
              rotulo="De-para de implantação"
              icone={<ClipboardCheck className="size-4" />}
              corIcone="bg-warning/12 text-warning"
              valor={num(base.depara)}
              secundario="Contas casadas"
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Base indisponível agora.</p>
        )}
      </section>

      {/* Série + feed recente */}
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

        <Card as="section" overflow padding="none" className="h-full">
          <div className="border-b border-hairline px-4 py-3">
            <h3 className="text-sm font-medium text-ink">Atividade recente</h3>
          </div>
          {recentes == null ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Indisponível agora.</p>
          ) : recentes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Sem atividade registrada.</p>
          ) : (
            <ul className="divide-y divide-hairline/60">
              {recentes.map((e) => (
                <li key={e.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink">{ROTULO_ACAO[e.acao] ?? e.acao}</span>
                    <span className="shrink-0 text-[11px] text-muted">{dataHoraBR(e.quando)}</span>
                  </div>
                  {e.alvo && (
                    <p className="truncate text-[11px] text-muted" title={e.alvo}>
                      {e.alvo}
                    </p>
                  )}
                  <p className="text-[11px] text-muted">{e.usuario}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
