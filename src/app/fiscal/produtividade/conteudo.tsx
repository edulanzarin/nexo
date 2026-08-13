"use client";

import { useMemo, useState } from "react";
import { Bot, FileText, Gauge, Users } from "lucide-react";
import clsx from "clsx";
import { ProdutividadeTabela } from "@/components/produtividade-tabela";
import { ProdutividadeSerieChart } from "@/components/charts/produtividade-serie-chart";
import { CalendarioAtividade } from "@/components/charts/calendario-atividade";
import { useFiltros } from "@/hooks/use-filters";
import {
  useProdutividade,
  useProdutividadeSerie,
  useProdutividadeCalendario,
} from "@/hooks/use-api";
import { brlCompact, num } from "@/lib/format";
import type { ColaboradorProd } from "@/lib/types";

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
  secundario: string;
}) {
  return (
    <div className="card anim-fade-up flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-2">{rotulo}</p>
        <span className={clsx("grid size-8 place-items-center rounded-lg", corIcone)}>{icone}</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{valor}</p>
      <p className="text-xs text-muted">{secundario}</p>
    </div>
  );
}

function Toggle({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-3 py-1.5 text-xs transition-colors",
        ativo
          ? "border-ent/30 bg-accent/12 font-medium text-accent"
          : "border-hairline bg-surface-2 text-muted hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

export default function ProdutividadePage() {
  const { qs } = useFiltros();
  const [ocultarSistema, setOcultarSistema] = useState(false);
  const [soAtivos, setSoAtivos] = useState(false);

  const prod = useProdutividade(qs);
  const serie = useProdutividadeSerie(qs);
  const calendario = useProdutividadeCalendario(qs);

  const todos = prod.data;

  const resumo = useMemo(() => {
    if (!todos) return null;
    const humanos = todos.filter((c) => !c.auto);
    const auto = todos.find((c) => c.auto);
    const soma = (sel: (c: ColaboradorProd) => number) =>
      humanos.reduce((acc, c) => acc + sel(c), 0);
    const notasHumano = soma((c) => c.notas);
    const autoNotas = auto?.notas ?? 0;
    const totalGeral = notasHumano + autoNotas;
    return {
      notasHumano,
      entHumano: soma((c) => c.notasEnt),
      saiHumano: soma((c) => c.notasSai),
      valorHumano: soma((c) => c.valor),
      nHumanos: humanos.length,
      inativos: humanos.filter((c) => c.inativo).length,
      media: humanos.length ? Math.round(notasHumano / humanos.length) : 0,
      autoNotas,
      autoPct: totalGeral > 0 ? (autoNotas / totalGeral) * 100 : 0,
    };
  }, [todos]);

  const visiveis = useMemo(
    () => todos?.filter((c) => (!ocultarSistema || !c.auto) && (!soAtivos || !c.inativo)),
    [todos, ocultarSistema, soAtivos]
  );

  const totalVisiveis = useMemo(
    () => visiveis?.reduce((acc, c) => acc + c.notas, 0) ?? 0,
    [visiveis]
  );

  const carregando = prod.isLoading;
  const recarregando = prod.isFetching && !prod.isLoading;

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {carregando || !resumo ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <Kpi
              rotulo="Notas lançadas"
              icone={<FileText className="size-4 text-ent" />}
              corIcone="bg-ent/12"
              valor={num(resumo.notasHumano)}
              secundario={`${num(resumo.entHumano)} entradas · ${num(resumo.saiHumano)} saídas`}
            />
            <Kpi
              rotulo="Colaboradores ativos"
              icone={<Users className="size-4 text-sai" />}
              corIcone="bg-sai/12"
              valor={num(resumo.nHumanos)}
              secundario={
                resumo.inativos > 0
                  ? `${num(resumo.inativos)} já desligados no período`
                  : "todos ativos no Questor"
              }
            />
            <Kpi
              rotulo="Média por colaborador"
              icone={<Gauge className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={num(resumo.media)}
              secundario={`notas/pessoa · ${brlCompact(resumo.valorHumano)} movimentados`}
            />
            <Kpi
              rotulo="Lançamento automático"
              icone={<Bot className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={num(resumo.autoNotas)}
              secundario={`${resumo.autoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total · Sistema (e-Doc)`}
            />
          </>
        )}
      </div>

      {/* Controles da aba */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-muted">Exibir:</span>
        <Toggle ativo={ocultarSistema} onClick={() => setOcultarSistema((v) => !v)}>
          Ocultar sistema
        </Toggle>
        <Toggle ativo={soAtivos} onClick={() => setSoAtivos((v) => !v)}>
          Só colaboradores ativos
        </Toggle>
      </div>

      {/* Ranking (largura total) */}
      <ProdutividadeTabela
        dados={visiveis}
        carregando={carregando}
        recarregando={recarregando}
        totalNotas={totalVisiveis}
      />

      {/* Tendência + calendário */}
      <ProdutividadeSerieChart
        dados={serie.data}
        carregando={serie.isLoading}
        recarregando={serie.isFetching && !serie.isLoading}
      />
      <CalendarioAtividade
        dados={calendario.data}
        carregando={calendario.isLoading}
        recarregando={calendario.isFetching && !calendario.isLoading}
      />
    </>
  );
}
