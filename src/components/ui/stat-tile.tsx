"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./card";

/**
 * Bloco de número-grande do dashboard. Unifica os três que existiam soltos: o
 * KPI grande (kpi-cards), o KPI compacto (kpi-conf) e o mini-tile de borda
 * (impostos). `size` fecha a escala; `icon`/`delta`/`secundario`/`alerta` abrem
 * o conteúdo. Cartão por padrão; `as="cell"` para o mini de borda em grades densas.
 */
export type StatTileSize = "lg" | "md" | "mini";

const NUM: Record<StatTileSize, string> = {
  lg: "text-[2rem] leading-none",
  md: "text-3xl leading-none",
  mini: "text-xl leading-none",
};

export function StatTile({
  size = "lg",
  rotulo,
  valor,
  valorCheio,
  icon,
  iconTint = "bg-surface-2",
  secundario,
  delta,
  alerta,
  hoverLift,
  as = "card",
  className,
}: {
  size?: StatTileSize;
  rotulo: string;
  valor: React.ReactNode;
  /** Valor por extenso no `title` (o `valor` costuma vir compacto). */
  valorCheio?: string;
  icon?: React.ReactNode;
  /** Classe de fundo do chip de ícone (ou cor do ponto, no mini). Ex.: `bg-ent/12`. */
  iconTint?: string;
  secundario?: React.ReactNode;
  delta?: React.ReactNode;
  /** Pinta o número de crítico (métrica em alerta). */
  alerta?: boolean;
  hoverLift?: boolean;
  as?: "card" | "cell";
  className?: string;
}) {
  const numero = (
    <p
      className={cn(
        "tnum font-semibold tracking-tight",
        NUM[size],
        alerta && "text-critical"
      )}
      title={valorCheio}
    >
      {valor}
    </p>
  );

  // Mini: célula com borda, ponto de cor opcional, layout compacto.
  if (size === "mini" || as === "cell") {
    return (
      <div className={cn("flex flex-col gap-1.5 rounded-lg border border-hairline p-3", className)}>
        <div className="flex items-center gap-1.5">
          {icon ? icon : <span className={cn("size-2 rounded-sm", iconTint)} />}
          <p className="text-[11px] font-medium text-ink-2">{rotulo}</p>
        </div>
        {numero}
        {secundario && <p className="text-[11px] text-muted">{secundario}</p>}
        {delta}
      </div>
    );
  }

  const chip = size === "lg" ? "size-9 rounded-xl" : "size-8 rounded-lg";

  return (
    <Card
      padding="md"
      className={cn(
        "flex flex-col gap-3",
        hoverLift &&
          "transition-transform duration-200 [transition-timing-function:var(--ease-spring)] hover:-translate-y-1",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-2">{rotulo}</p>
        {icon && (
          <span
            className={cn(
              "grid place-items-center ring-1 ring-inset ring-[var(--tile-icon-ring)]",
              chip,
              iconTint
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {numero}
      {(secundario || delta) && (
        <div className="mt-auto flex flex-col gap-1.5">
          {secundario && <p className="text-xs text-muted">{secundario}</p>}
          {delta}
        </div>
      )}
    </Card>
  );
}

/**
 * Variação percentual vs período anterior, com seta e cor semântica. `null` vira
 * "sem base anterior". `bomQuandoSobe=false` inverte o juízo (ex.: cancelamentos:
 * subir é ruim). Vivia dentro de kpi-cards; agora acompanha o StatTile.
 */
export function Delta({
  pct,
  bomQuandoSobe = true,
  sufixo = "vs período anterior",
}: {
  pct: number | null;
  bomQuandoSobe?: boolean;
  sufixo?: string;
}) {
  if (pct === null) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted">
        <Minus className="size-3.5" /> sem base anterior
      </span>
    );
  }
  const subiu = pct >= 0;
  const bom = subiu === bomQuandoSobe;
  const Icone = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", bom ? "text-good" : "text-critical")}>
      <Icone className="size-3.5" />
      {Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      {sufixo && <span className="font-normal text-muted">{sufixo}</span>}
    </span>
  );
}
