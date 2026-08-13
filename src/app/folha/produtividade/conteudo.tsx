"use client";

import { useMemo, useState } from "react";
import { CalendarClock, FileMinus, LayoutDashboard, LogOut, Plane, UserPlus } from "lucide-react";
import clsx from "clsx";
import { DpRankingTabela } from "@/components/dp-ranking-tabela";
import { DpBarras } from "@/components/dp-barras";
import { DpComposicaoDonut, DpColaboradorStack } from "@/components/dp-composicao";
import { DpFuncionarioFiltro } from "@/components/dp-funcionario-filtro";
import { DpSerieChart } from "@/components/charts/dp-serie-chart";
import { Card } from "@/components/ui";
import { useFiltros } from "@/hooks/use-filters";
import { useDpProdutividade, useDpQuebra } from "@/hooks/use-api";
import { num, deltaPct } from "@/lib/format";
import { DP_TIPOS, type DpColaborador, type DpTipo } from "@/lib/dp-tipos";
import { useProdutividadeTabs } from "./tabs";

const COR: Record<DpTipo, string> = {
  avisos: "var(--warning)",
  rescisoes: "var(--critical)",
  admissoes: "var(--ent)",
  ferias: "var(--sai)",
};

const ICONE: Record<DpTipo | "total", React.ReactNode> = {
  total: <CalendarClock className="size-4 text-ink-2" />,
  avisos: <FileMinus className="size-4 text-warning" />,
  rescisoes: <LogOut className="size-4 text-critical" />,
  admissoes: <UserPlus className="size-4 text-ent" />,
  ferias: <Plane className="size-4 text-sai" />,
};

const BG_ICONE: Record<DpTipo | "total", string> = {
  total: "bg-surface-2",
  avisos: "bg-warning/12",
  rescisoes: "bg-critical/12",
  admissoes: "bg-ent/12",
  ferias: "bg-sai/12",
};

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  const d = deltaPct(atual, anterior);
  if (d == null) return <span className="text-muted">sem base anterior</span>;
  const zero = Math.abs(d) < 0.05;
  return (
    <span className={clsx(zero ? "text-muted" : d > 0 ? "text-ent" : "text-critical")}>
      {zero ? "estável" : `${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. anterior`}
    </span>
  );
}

function Kpi({
  rotulo,
  icone,
  corIcone,
  valor,
  secundario,
}: {
  rotulo: string;
  icone: React.ReactNode;
  corIcone: string;
  valor: string;
  secundario: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-2">{rotulo}</p>
        <span className={clsx("grid size-8 place-items-center rounded-lg", corIcone)}>{icone}</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{valor}</p>
      <p className="text-xs">{secundario}</p>
    </Card>
  );
}

/** Aba de um trabalho: só dashboard (KPIs + por colaborador + por empresa + série). */
function AbaTipo({
  tipo,
  qs,
  ranking,
  totais,
  anterior,
  carregandoResumo,
  usuarioSel,
  onSelecionar,
}: {
  tipo: DpTipo;
  qs: string;
  ranking: DpColaborador[] | undefined;
  totais: Record<DpTipo, number> | undefined;
  anterior: Record<DpTipo, number> | undefined;
  carregandoResumo: boolean;
  usuarioSel: number | null;
  onSelecionar: (codigo: number | null) => void;
}) {
  const rotulo = DP_TIPOS.find((t) => t.id === tipo)!.rotulo;
  const cor = COR[tipo];

  // Filtro por colaborador vale para série e por-empresa (não para o
  // ranking/por-colaborador, que é a comparação entre pessoas).
  const listaQs = usuarioSel != null ? `${qs}&usuario=${usuarioSel}` : qs;
  const quebra = useDpQuebra(listaQs, tipo);

  // Quebra por colaborador: sai do ranking já carregado (quem fez ESTE trabalho).
  const porColaborador = useMemo(
    () =>
      ranking
        ? ranking
            .map((c) => ({ codigo: c.codigo, nome: c.nome, qtd: c[tipo] }))
            .filter((c) => c.qtd > 0)
            .sort((a, b) => b.qtd - a.qtd)
        : undefined,
    [ranking, tipo]
  );

  const selNome = usuarioSel != null ? ranking?.find((c) => c.codigo === usuarioSel)?.nome : null;
  const colabTipo = usuarioSel != null ? ranking?.find((c) => c.codigo === usuarioSel)?.[tipo] ?? 0 : null;

  const nColab = porColaborador?.filter((c) => c.codigo !== 0).length ?? 0;
  const totalTeam = totais?.[tipo] ?? 0;
  const totalMostrado = colabTipo != null ? colabTipo : totalTeam;
  const nEmpresas = quebra.data?.porEmpresa.length ?? 0;
  const media = nColab > 0 ? Math.round(totalTeam / nColab) : 0;
  const topEmpresa = quebra.data?.porEmpresa[0];
  const topColab = porColaborador?.[0];

  return (
    <>
      {/* KPIs do trabalho */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {carregandoResumo || !totais || !anterior ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <Kpi
              rotulo={rotulo}
              icone={ICONE[tipo]}
              corIcone={BG_ICONE[tipo]}
              valor={num(totalMostrado)}
              secundario={
                colabTipo != null ? (
                  <span className="text-muted">de {selNome}</span>
                ) : (
                  <Delta atual={totalTeam} anterior={anterior[tipo]} />
                )
              }
            />
            <Kpi
              rotulo="Colaboradores"
              icone={<UserPlus className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={num(usuarioSel != null ? 1 : nColab)}
              secundario={
                <span className="text-muted">
                  {topColab ? `líder: ${topColab.nome}` : "ninguém no período"}
                </span>
              }
            />
            <Kpi
              rotulo="Empresas atendidas"
              icone={<CalendarClock className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={quebra.isLoading ? "…" : num(nEmpresas)}
              secundario={
                <span className="text-muted">
                  {topEmpresa ? `maior: ${topEmpresa.nome}` : "—"}
                </span>
              }
            />
            <Kpi
              rotulo="Média por colaborador"
              icone={<LayoutDashboard className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={num(media)}
              secundario={<span className="text-muted">registros/pessoa no time</span>}
            />
          </>
        )}
      </div>

      {/* Por colaborador (eixo principal) + por empresa */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DpBarras
          titulo="Por colaborador"
          subtitulo="Quem fez este trabalho no período · clique para isolar"
          dados={porColaborador}
          cor={cor}
          carregando={carregandoResumo}
          recarregando={false}
          rotuloEixo="Colaborador"
          selecionado={usuarioSel}
          onSelecionar={onSelecionar}
        />
        <DpBarras
          titulo="Por empresa"
          subtitulo={usuarioSel != null ? `Empresas de ${selNome}` : "Onde o trabalho aconteceu"}
          dados={quebra.data?.porEmpresa}
          cor={cor}
          carregando={quebra.isLoading}
          recarregando={quebra.isFetching && !quebra.isLoading}
          rotuloEixo="Empresa"
        />
      </div>

      {/* Evolução no tempo */}
      <DpSerieChart
        titulo="Evolução no período"
        dados={quebra.data}
        cor={cor}
        carregando={quebra.isLoading}
        recarregando={quebra.isFetching && !quebra.isLoading}
      />
    </>
  );
}

export default function ProdutividadeDpPage() {
  const { qs } = useFiltros();
  const { menu } = useProdutividadeTabs();
  const [usuarioSel, setUsuarioSel] = useState<number | null>(null);

  const resumo = useDpProdutividade(qs);
  const t = resumo.data?.totais;
  const ant = resumo.data?.anterior;
  const carregandoResumo = resumo.isLoading;

  return (
    <div className="flex flex-col gap-5">
      {/* Filtro por funcionário da Navecon — recorta o dashboard inteiro */}
      <div className="flex flex-wrap items-center gap-2">
        <DpFuncionarioFiltro
          dados={resumo.data?.ranking}
          valor={usuarioSel}
          onMudar={setUsuarioSel}
        />
        {usuarioSel != null && (
          <span className="text-xs text-muted">
            Mostrando só o trabalho deste funcionário · o ranking segue com o time todo
          </span>
        )}
      </div>

      {menu === "geral" ? (
        <>
          {/* KPIs — os quatro trabalhos + total, com delta vs. período anterior */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {carregandoResumo || !t || !ant ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-36" />)
            ) : (
              <>
                <Kpi
                  rotulo="Avisos prévios"
                  icone={ICONE.avisos}
                  corIcone={BG_ICONE.avisos}
                  valor={num(t.avisos)}
                  secundario={<Delta atual={t.avisos} anterior={ant.avisos} />}
                />
                <Kpi
                  rotulo="Rescisões calculadas"
                  icone={ICONE.rescisoes}
                  corIcone={BG_ICONE.rescisoes}
                  valor={num(t.rescisoes)}
                  secundario={<Delta atual={t.rescisoes} anterior={ant.rescisoes} />}
                />
                <Kpi
                  rotulo="Admissões feitas"
                  icone={ICONE.admissoes}
                  corIcone={BG_ICONE.admissoes}
                  valor={num(t.admissoes)}
                  secundario={<Delta atual={t.admissoes} anterior={ant.admissoes} />}
                />
                <Kpi
                  rotulo="Férias calculadas"
                  icone={ICONE.ferias}
                  corIcone={BG_ICONE.ferias}
                  valor={num(t.ferias)}
                  secundario={<Delta atual={t.ferias} anterior={ant.ferias} />}
                />
                <Kpi
                  rotulo="Total no período"
                  icone={ICONE.total}
                  corIcone={BG_ICONE.total}
                  valor={num(t.total)}
                  secundario={
                    <span className="text-muted">
                      {num(resumo.data!.colaboradores)} colaboradores do DP
                    </span>
                  }
                />
              </>
            )}
          </div>

          {/* Mais dashboard: composição dos quatro trabalhos + top empilhado */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DpComposicaoDonut
              totais={t}
              cores={COR}
              carregando={carregandoResumo}
              recarregando={resumo.isFetching && !resumo.isLoading}
            />
            <DpColaboradorStack
              dados={resumo.data?.ranking}
              cores={COR}
              carregando={resumo.isLoading}
              recarregando={resumo.isFetching && !resumo.isLoading}
              selecionado={usuarioSel}
              onSelecionar={setUsuarioSel}
            />
          </div>

          <DpRankingTabela
            dados={resumo.data?.ranking}
            carregando={resumo.isLoading}
            recarregando={resumo.isFetching && !resumo.isLoading}
            selecionado={usuarioSel}
            onSelecionar={setUsuarioSel}
          />

          <p className="text-center text-xs text-muted">
            Selecione um colaborador.
          </p>
        </>
      ) : (
        <AbaTipo
          tipo={menu}
          qs={qs}
          ranking={resumo.data?.ranking}
          totais={t}
          anterior={ant}
          carregandoResumo={carregandoResumo}
          usuarioSel={usuarioSel}
          onSelecionar={setUsuarioSel}
        />
      )}
    </div>
  );
}
