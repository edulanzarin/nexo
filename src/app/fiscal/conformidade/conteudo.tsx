"use client";

import { AlertTriangle, Ban, KeyRound, Tags } from "lucide-react";
import clsx from "clsx";
import { ConformidadeTabela } from "@/components/conformidade-tabela";
import { ChartCard } from "@/components/ui/chart-card";
import { useFiltros } from "@/hooks/use-filters";
import { useConformidade, useConformidadeEmpresas } from "@/hooks/use-api";
import { num } from "@/lib/format";

function Kpi({
  rotulo,
  icone,
  corIcone,
  valor,
  secundario,
  alerta,
}: {
  rotulo: string;
  icone: React.ReactNode;
  corIcone: string;
  valor: string;
  secundario: string;
  alerta?: boolean;
}) {
  return (
    <div className="card anim-fade-up flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-2">{rotulo}</p>
        <span className={clsx("grid size-8 place-items-center rounded-lg", corIcone)}>{icone}</span>
      </div>
      <p className={clsx("text-3xl font-semibold tracking-tight", alerta && "text-critical")}>
        {valor}
      </p>
      <p className="text-xs text-muted">{secundario}</p>
    </div>
  );
}

const pct = (parte: number, total: number) =>
  total > 0 ? `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—";

function corSituacao(codigo: number): string {
  if (codigo === 0) return "var(--good)";
  if (codigo === 2) return "var(--critical)";
  return "var(--warning)";
}

export default function ConformidadePage() {
  const { qs } = useFiltros();
  const resumo = useConformidade(qs);
  const empresas = useConformidadeEmpresas(qs);
  const r = resumo.data;

  const maxSit = r ? Math.max(1, ...r.situacoes.map((s) => s.qtd)) : 1;

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {resumo.isLoading || !r ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <Kpi
              rotulo="Itens com NCM inválido"
              icone={<Tags className="size-4 text-critical" />}
              corIcone="bg-critical/12"
              valor={num(r.ncmInvalidoItens)}
              secundario={`${num(r.ncmInvalidoProdutos)} produtos a corrigir · ${pct(r.ncmInvalidoItens, r.totalItens)} dos itens`}
              alerta={r.ncmInvalidoItens > 0}
            />
            <Kpi
              rotulo="Notas canceladas"
              icone={<Ban className="size-4 text-critical" />}
              corIcone="bg-critical/12"
              valor={num(r.canceladas)}
              secundario={`${pct(r.canceladas, r.totalNotas)} das notas de saída`}
            />
            <Kpi
              rotulo="Denegadas / inutilizadas"
              icone={<AlertTriangle className="size-4 text-warning" />}
              corIcone="bg-warning/12"
              valor={num(r.denegadas)}
              secundario="situação especial (≠ normal e ≠ cancelada)"
            />
            <Kpi
              rotulo="Sem chave de acesso"
              icone={<KeyRound className="size-4 text-warning" />}
              corIcone="bg-warning/12"
              valor={num(r.semChave)}
              secundario="NFe/NFCe/CTe sem a chave de 44 dígitos"
            />
          </>
        )}
      </div>

      {/* Situação das notas + tabela de pendências */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          titulo="Situação das notas"
          carregando={resumo.isLoading || !r}
          recarregando={resumo.isFetching && !resumo.isLoading}
          alturaSkeleton="h-64"
        >
          <div className="flex flex-col gap-3">
            {r?.situacoes.map((s) => (
              <div key={s.codigo}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-2">{s.nome}</span>
                  <span className="tabular-nums text-muted">
                    {num(s.qtd)} · {pct(s.qtd, r.totalNotas)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(s.qtd / maxSit) * 100}%`, background: corSituacao(s.codigo) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <div className="xl:col-span-2">
          <ConformidadeTabela
            dados={empresas.data}
            carregando={empresas.isLoading}
            recarregando={empresas.isFetching && !empresas.isLoading}
          />
        </div>
      </div>
    </>
  );
}
