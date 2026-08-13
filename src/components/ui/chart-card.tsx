"use client";

import clsx from "clsx";
import { Card } from "./card";

interface ChartCardProps {
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
  carregando?: boolean;
  recarregando?: boolean;
  alturaSkeleton?: string;
  children: React.ReactNode;
}

export function ChartCard({
  titulo,
  subtitulo,
  acao,
  carregando,
  recarregando,
  alturaSkeleton = "h-64",
  children,
}: ChartCardProps) {
  return (
    <Card as="section" className="flex flex-col">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>}
        </div>
        {acao}
      </header>
      {carregando ? (
        <div className={clsx("skeleton w-full", alturaSkeleton)} />
      ) : (
        <div className={clsx(recarregando && "refetching")}>{children}</div>
      )}
    </Card>
  );
}

export function LegendaSeries({
  series,
}: {
  series: { nome: string; cor: string }[];
}) {
  return (
    <div className="flex items-center gap-4">
      {series.map((s) => (
        <span key={s.nome} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: s.cor }} />
          {s.nome}
        </span>
      ))}
    </div>
  );
}

export function TooltipContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-lg px-3 py-2">{children}</div>
  );
}

export function TooltipLinha({
  cor,
  nome,
  valor,
}: {
  cor?: string;
  nome: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      {cor && <span className="h-0.5 w-3 rounded-full" style={{ background: cor }} />}
      <span className="text-muted">{nome}</span>
      <span className="tnum ml-auto pl-4 font-semibold text-ink">{valor}</span>
    </div>
  );
}
