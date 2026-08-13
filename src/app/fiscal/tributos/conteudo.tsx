"use client";

import { useMemo, useState } from "react";
import { Coins, Landmark, MapPin, Percent } from "lucide-react";
import clsx from "clsx";
import { ImpostosCard } from "@/components/impostos-card";
import { TopBarChart } from "@/components/charts/top-bar-chart";
import { CargaTabela } from "@/components/carga-tabela";
import { useFiltros } from "@/hooks/use-filters";
import {
  useImpostos,
  useTributosDifal,
  useTributosCst,
  useTributosCargaEmpresas,
} from "@/hooks/use-api";
import { brl, brlCompact } from "@/lib/format";

type Tipo = "ent" | "sai";

function Kpi({
  rotulo,
  icone,
  corIcone,
  valor,
  valorCheio,
  secundario,
}: {
  rotulo: string;
  icone: React.ReactNode;
  corIcone: string;
  valor: string;
  valorCheio?: string;
  secundario: string;
}) {
  return (
    <div className="card anim-fade-up flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-2">{rotulo}</p>
        <span className={clsx("grid size-8 place-items-center rounded-lg", corIcone)}>{icone}</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight" title={valorCheio}>
        {valor}
      </p>
      <p className="text-xs text-muted">{secundario}</p>
    </div>
  );
}

export default function TributosPage() {
  const { qs } = useFiltros();
  const [tipoImpostos, setTipoImpostos] = useState<Tipo>("sai");

  const impostos = useImpostos(qs, "sai");
  const difal = useTributosDifal(qs);
  const cst = useTributosCst(qs);
  const carga = useTributosCargaEmpresas(qs);
  const impostosCard = useImpostos(qs, tipoImpostos);

  const resumo = useMemo(() => {
    const d = impostos.data;
    if (!d) return null;
    const destacados = d.icms + d.st + d.ipi + d.iss + d.pis + d.cofins;
    const retencoes = d.irrf + d.inss + d.csll + d.issqn;
    return {
      destacados,
      cargaPct: d.totalItens > 0 ? (destacados / d.totalItens) * 100 : 0,
      faturamento: d.totalItens,
      difalFcp: d.difal + d.fcp,
      icms: d.icms,
      retencoes,
    };
  }, [impostos.data]);

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {impostos.isLoading || !resumo ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <Kpi
              rotulo="Tributos destacados"
              icone={<Coins className="size-4 text-ent" />}
              corIcone="bg-ent/12"
              valor={brlCompact(resumo.destacados)}
              valorCheio={brl(resumo.destacados)}
              secundario="ICMS+ST+IPI+ISS+PIS+COFINS (saídas)"
            />
            <Kpi
              rotulo="Carga tributária"
              icone={<Percent className="size-4 text-sai" />}
              corIcone="bg-sai/12"
              valor={`${resumo.cargaPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              secundario={`sobre ${brlCompact(resumo.faturamento)} faturados`}
            />
            <Kpi
              rotulo="DIFAL + FCP a recolher"
              icone={<MapPin className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={brlCompact(resumo.difalFcp)}
              valorCheio={brl(resumo.difalFcp)}
              secundario="interestadual (saídas)"
            />
            <Kpi
              rotulo="ICMS"
              icone={<Landmark className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={brlCompact(resumo.icms)}
              valorCheio={brl(resumo.icms)}
              secundario={`o maior tributo · ${resumo.faturamento > 0 ? ((resumo.icms / resumo.faturamento) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}% do faturado`}
            />
          </>
        )}
      </div>

      {/* Composição dos impostos (reaproveita o card do Painel, com ent/saí) */}
      <ImpostosCard
        dados={impostosCard.data}
        carregando={impostosCard.isLoading}
        recarregando={impostosCard.isFetching && !impostosCard.isLoading}
        tipo={tipoImpostos}
        onTipo={setTipoImpostos}
      />

      {/* DIFAL por UF + CST */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TopBarChart
          titulo="DIFAL + FCP por UF de destino"
          subtituloEnt=""
          subtituloSai=""
          dados={difal.data}
          carregando={difal.isLoading}
          recarregando={difal.isFetching && !difal.isLoading}
          tipo="sai"
          onTipo={() => {}}
          metrica="valor"
          rotuloQtd="Notas"
          semSeletor
        />
        <TopBarChart
          titulo="Regime tributário (CST PIS/COFINS)"
          subtituloEnt=""
          subtituloSai=""
          dados={cst.data}
          carregando={cst.isLoading}
          recarregando={cst.isFetching && !cst.isLoading}
          tipo="sai"
          onTipo={() => {}}
          metrica="qtd"
          rotuloQtd="Itens"
          semSeletor
        />
      </div>

      {/* Carga por empresa */}
      <CargaTabela
        dados={carga.data}
        carregando={carga.isLoading}
        recarregando={carga.isFetching && !carga.isLoading}
      />
    </>
  );
}
