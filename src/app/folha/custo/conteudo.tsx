"use client";

import { useMemo } from "react";
import { AlertTriangle, Banknote, Building2, Receipt, Users, Wallet } from "lucide-react";
import { Kpi } from "@/components/kpi-conf";
import { CustoQuebra } from "@/components/custo-quebra";
import { Card, EmptyState } from "@/components/ui";
import { useFiltros } from "@/hooks/use-filters";
import { useCustoFolha } from "@/hooks/use-api";
import { brl, brlCompact, num } from "@/lib/format";
import type { CustoRubrica } from "@/lib/types";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesLabel = (compet: string) => {
  const [a, m] = compet.split("-");
  return `${MESES[Number(m) - 1] ?? m}/${(a ?? "").slice(2)}`;
};

/** Tabela enxuta de rubricas de um lado (proventos ou descontos). */
function RubricaLista({ titulo, itens }: { titulo: string; itens: CustoRubrica[] }) {
  const max = Math.max(1, ...itens.map((i) => i.total));
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">{titulo}</p>
      {itens.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">Nada no período</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((i) => (
            <li key={i.codigo}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-ink" title={i.descricao}>
                  {i.descricao}
                </span>
                <span className="shrink-0 tabular-nums text-ink-2">{brl(i.total)}</span>
              </div>
              <div className="mt-1 h-1 rounded bg-ent/15">
                <div className="h-1 rounded bg-ent" style={{ width: `${(i.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CustoFolhaPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const res = useCustoFolha(qs, temEmpresa);
  const dados = res.data;

  const maxTipo = useMemo(
    () => (dados ? Math.max(1, ...dados.porTipo.map((t) => t.proventos)) : 1),
    [dados]
  );
  const maxSerie = useMemo(
    () => (dados ? Math.max(1, ...dados.serie.map((p) => p.proventos)) : 1),
    [dados]
  );
  const proventos = dados?.rubricas.filter((r) => r.lado === "provento") ?? [];
  const descontos = dados?.rubricas.filter((r) => r.lado === "desconto") ?? [];

  if (!temEmpresa) {
    return (
      <EmptyState
        icon={<Building2 className="size-6" />}
        titulo="Selecione uma empresa"
        descricao="O custo de folha é apurado de uma empresa por vez, no período escolhido."
      />
    );
  }

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível apurar o custo"
        descricao={res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
      />
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Somando a folha do período…</p>
      </section>
    );
  }

  if (dados.resumo.funcionarios === 0) {
    return (
      <section className="card grid place-items-center px-6 py-14 text-center">
        <p className="text-sm text-muted">Sem folha calculada no período para esta empresa.</p>
      </section>
    );
  }

  const { resumo } = dados;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Custo de remuneração"
          icone={<Wallet className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={brlCompact(resumo.proventos)}
          secundario={`${brl(resumo.proventos)} em proventos (sem encargos patronais)`}
        />
        <Kpi
          rotulo="Descontos"
          icone={<Receipt className="size-4" />}
          corIcone="bg-surface-2 text-ink-2"
          valor={brlCompact(resumo.descontos)}
          secundario="INSS, IRRF, vales e faltas retidos"
        />
        <Kpi
          rotulo="Líquido"
          icone={<Banknote className="size-4" />}
          corIcone="bg-good/12 text-good"
          valor={brlCompact(resumo.liquido)}
          secundario="Proventos − descontos"
        />
        <Kpi
          rotulo="Funcionários"
          icone={<Users className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={num(resumo.funcionarios)}
          secundario={`Custo médio ${brl(resumo.custoMedio)} por pessoa`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Composição por tipo de folha */}
        <Card as="section">
          <h2 className="text-sm font-semibold">Composição por tipo de folha</h2>
          <ul className="space-y-3">
            {dados.porTipo.map((t) => (
              <li key={t.tipo}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink" title={t.descricao}>
                    {t.descricao}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-2">{brl(t.proventos)}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-ent/15">
                  <div
                    className="h-2 rounded bg-ent"
                    style={{ width: `${(t.proventos / maxTipo) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Evolução mensal */}
        <Card as="section">
          <h2 className="text-sm font-semibold">Evolução mensal</h2>
          {dados.serie.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">Sem competências no período</p>
          ) : (
            <div className="flex h-44 items-end gap-2">
              {dados.serie.map((p) => (
                <div key={p.compet} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-ent transition-all hover:bg-ent/80"
                      style={{ height: `${Math.max(2, (p.proventos / maxSerie) * 100)}%` }}
                      title={`${mesLabel(p.compet)}: ${brl(p.proventos)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{mesLabel(p.compet)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Rubricas (memória do custo) */}
      <Card as="section">
        <h2 className="text-sm font-semibold">Principais rubricas</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <RubricaLista titulo="Proventos" itens={proventos} />
          <RubricaLista titulo="Descontos" itens={descontos} />
        </div>
      </Card>

      {/* Quebras */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CustoQuebra
          titulo="Custo por setor"
          subtitulo=""
          rotuloColuna="Setor"
          dados={dados.porSetor}
        />
        <CustoQuebra
          titulo="Custo por cargo"
          subtitulo=""
          rotuloColuna="Cargo"
          dados={dados.porCargo}
        />
      </div>
      <CustoQuebra
        titulo="Custo por estabelecimento"
        subtitulo=""
        rotuloColuna="Estabelecimento"
        dados={dados.porEstabelecimento}
      />
    </div>
  );
}
