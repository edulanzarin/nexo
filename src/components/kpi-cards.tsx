"use client";

import { Ban, Building2, TrendingDown, TrendingUp } from "lucide-react";
import clsx from "clsx";
import type { LadoResumo, Metrica, Overview } from "@/lib/types";
import { brl, brlCompact, num, numCompact, deltaPct } from "@/lib/format";
import { StatTile, Delta } from "@/components/ui";

interface KpiCardsProps {
  overview: Overview | undefined;
  carregando: boolean;
  recarregando: boolean;
  metrica: Metrica;
}

function TileSkeleton() {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-9 w-36" />
      <div className="skeleton h-3 w-28" />
      <div className="skeleton h-3 w-40" />
    </div>
  );
}

/** A métrica escolhida vira o número grande; a outra vai pra linha secundária. */
function ladoTile(lado: LadoResumo, metrica: Metrica) {
  const ticket = lado.qtd > 0 ? lado.valor / lado.qtd : 0;
  if (metrica === "valor") {
    return {
      valor: brlCompact(lado.valor),
      valorCheio: brl(lado.valor),
      secundario: `${num(lado.qtd)} notas · ticket médio ${brl(ticket)}`,
      pct: deltaPct(lado.valor, lado.valorAnterior),
    };
  }
  return {
    valor: `${numCompact(lado.qtd)} notas`,
    valorCheio: `${num(lado.qtd)} notas`,
    secundario: `${brlCompact(lado.valor)} · ticket médio ${brl(ticket)}`,
    pct: deltaPct(lado.qtd, lado.qtdAnterior),
  };
}

export function KpiCards({ overview, carregando, recarregando, metrica }: KpiCardsProps) {
  if (carregando || !overview) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <TileSkeleton key={i} />
        ))}
      </div>
    );
  }

  const { entradas, saidas } = overview;
  const ent = ladoTile(entradas, metrica);
  const sai = ladoTile(saidas, metrica);
  const canceladas = entradas.canceladas + saidas.canceladas;
  const totalNotas = entradas.qtd + saidas.qtd;

  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        recarregando && "refetching"
      )}
    >
      <StatTile
        hoverLift
        rotulo="Notas de entrada"
        icon={<TrendingDown className="size-4 text-ent" />}
        iconTint="bg-ent/12"
        valor={ent.valor}
        valorCheio={ent.valorCheio}
        secundario={ent.secundario}
        delta={<Delta pct={ent.pct} />}
      />
      <StatTile
        hoverLift
        rotulo="Notas de saída"
        icon={<TrendingUp className="size-4 text-sai" />}
        iconTint="bg-sai/12"
        valor={sai.valor}
        valorCheio={sai.valorCheio}
        secundario={sai.secundario}
        delta={<Delta pct={sai.pct} />}
      />
      <StatTile
        hoverLift
        rotulo="Empresas com movimento"
        icon={<Building2 className="size-4 text-ink-2" />}
        iconTint="bg-surface-2"
        valor={num(overview.empresasAtivas)}
        secundario="lançaram ao menos uma nota no período"
        delta={<Delta pct={deltaPct(overview.empresasAtivas, overview.empresasAtivasAnterior)} />}
      />
      <StatTile
        hoverLift
        rotulo="Notas canceladas"
        icon={<Ban className="size-4 text-critical" />}
        iconTint="bg-critical/12"
        valor={num(canceladas)}
        secundario={
          totalNotas + canceladas > 0
            ? `${((canceladas / (totalNotas + canceladas)) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do total lançado`
            : "nenhuma nota no período"
        }
        delta={<span className="text-xs text-muted">excluídas dos totais acima</span>}
      />
    </div>
  );
}
