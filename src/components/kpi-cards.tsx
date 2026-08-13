"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Building2,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import type { LadoResumo, Metrica, Overview } from "@/lib/types";
import { brl, brlCompact, num, numCompact, deltaPct } from "@/lib/format";

interface KpiCardsProps {
  overview: Overview | undefined;
  carregando: boolean;
  recarregando: boolean;
  metrica: Metrica;
}

function Delta({ pct, bomQuandoSobe = true }: { pct: number | null; bomQuandoSobe?: boolean }) {
  if (pct === null)
    return (
      <span className="flex items-center gap-1 text-xs text-muted">
        <Minus className="size-3.5" /> sem base anterior
      </span>
    );
  const subiu = pct >= 0;
  const bom = subiu === bomQuandoSobe;
  const Icone = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        "flex items-center gap-1 text-xs font-medium",
        bom ? "text-good" : "text-critical"
      )}
    >
      <Icone className="size-3.5" />
      {Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      <span className="font-normal text-muted">vs período anterior</span>
    </span>
  );
}

function Tile({
  rotulo,
  icone,
  corIcone,
  valor,
  valorCheio,
  secundario,
  delta,
}: {
  rotulo: string;
  icone: React.ReactNode;
  corIcone: string;
  valor: string;
  valorCheio?: string;
  secundario: string;
  delta: React.ReactNode;
}) {
  return (
    <div className="card anim-fade-up flex flex-col gap-3 p-5 transition-all duration-200 hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-2">{rotulo}</p>
        <span
          className={clsx(
            "grid size-9 place-items-center rounded-xl ring-1 ring-inset ring-hairline",
            corIcone
          )}
        >
          {icone}
        </span>
      </div>
      <p className="tnum text-[2rem] font-semibold leading-none tracking-tight" title={valorCheio}>
        {valor}
      </p>
      <div className="mt-auto flex flex-col gap-1.5">
        <p className="text-xs text-muted">{secundario}</p>
        {delta}
      </div>
    </div>
  );
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
      <Tile
        rotulo="Notas de entrada"
        icone={<TrendingDown className="size-4 text-ent" />}
        corIcone="bg-ent/12"
        valor={ent.valor}
        valorCheio={ent.valorCheio}
        secundario={ent.secundario}
        delta={<Delta pct={ent.pct} />}
      />
      <Tile
        rotulo="Notas de saída"
        icone={<TrendingUp className="size-4 text-sai" />}
        corIcone="bg-sai/12"
        valor={sai.valor}
        valorCheio={sai.valorCheio}
        secundario={sai.secundario}
        delta={<Delta pct={sai.pct} />}
      />
      <Tile
        rotulo="Empresas com movimento"
        icone={<Building2 className="size-4 text-ink-2" />}
        corIcone="bg-surface-2"
        valor={num(overview.empresasAtivas)}
        secundario="lançaram ao menos uma nota no período"
        delta={
          <Delta pct={deltaPct(overview.empresasAtivas, overview.empresasAtivasAnterior)} />
        }
      />
      <Tile
        rotulo="Notas canceladas"
        icone={<Ban className="size-4 text-critical" />}
        corIcone="bg-critical/12"
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
