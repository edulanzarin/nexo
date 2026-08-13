"use client";

import { Landmark } from "lucide-react";
import clsx from "clsx";
import type { Impostos } from "@/lib/types";
import { brl, brlCompact } from "@/lib/format";
import { SeletorTipo } from "@/components/charts/top-bar-chart";

interface Props {
  dados: Impostos | undefined;
  carregando: boolean;
  recarregando: boolean;
  tipo: "ent" | "sai";
  onTipo: (t: "ent" | "sai") => void;
}

type Chave = keyof Impostos;

const PRINCIPAIS: { chave: Chave; rotulo: string; cor: string }[] = [
  { chave: "icms", rotulo: "ICMS", cor: "var(--esp-1)" },
  { chave: "st", rotulo: "ICMS-ST", cor: "var(--esp-4)" },
  { chave: "ipi", rotulo: "IPI", cor: "var(--esp-3)" },
  { chave: "iss", rotulo: "ISS", cor: "var(--esp-5)" },
  { chave: "pis", rotulo: "PIS", cor: "var(--esp-2)" },
  { chave: "cofins", rotulo: "COFINS", cor: "var(--ent)" },
];

const RETENCOES: { chave: Chave; rotulo: string }[] = [
  { chave: "irrf", rotulo: "IRRF" },
  { chave: "inss", rotulo: "INSS" },
  { chave: "csll", rotulo: "CSLL" },
  { chave: "issqn", rotulo: "ISSQN" },
];

const OUTROS: { chave: Chave; rotulo: string }[] = [
  { chave: "difal", rotulo: "DIFAL" },
  { chave: "fcp", rotulo: "FCP" },
  { chave: "funrural", rotulo: "FUNRURAL" },
];

function Tile({
  rotulo,
  cor,
  valor,
  base,
}: {
  rotulo: string;
  cor?: string;
  valor: number;
  base: number;
}) {
  const pct = base > 0 ? (valor / base) * 100 : 0;
  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="mb-1 flex items-center gap-1.5">
        {cor && <span className="size-2 rounded-sm" style={{ background: cor }} />}
        <span className="text-xs text-ink-2">{rotulo}</span>
      </div>
      <p className="text-xl font-semibold tracking-tight" title={brl(valor)}>
        {brlCompact(valor)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">
        {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do faturado
      </p>
    </div>
  );
}

function TileSkeleton() {
  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="skeleton mb-2 h-3 w-16" />
      <div className="skeleton h-6 w-24" />
    </div>
  );
}

export function ImpostosCard({ dados, carregando, recarregando, tipo, onTipo }: Props) {
  const temRetencao =
    dados && (dados.irrf > 0 || dados.inss > 0 || dados.csll > 0 || dados.issqn > 0);
  const temOutros = dados && (dados.difal > 0 || dados.fcp > 0 || dados.funrural > 0);

  return (
    <section className="card anim-fade-up p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink-2">
            <Landmark className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Impostos</h2>
          </div>
        </div>
        <SeletorTipo tipo={tipo} onTipo={onTipo} />
      </header>

      {carregando || !dados ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <TileSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className={clsx(recarregando && "refetching")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {PRINCIPAIS.map((imp) => (
              <Tile
                key={imp.chave}
                rotulo={imp.rotulo}
                cor={imp.cor}
                valor={dados[imp.chave]}
                base={dados.totalItens}
              />
            ))}
          </div>

          {temRetencao && (
            <>
              <p className="mt-4 mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                Retenções (notas de serviço)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {RETENCOES.map((imp) => (
                  <Tile
                    key={imp.chave}
                    rotulo={imp.rotulo}
                    valor={dados[imp.chave]}
                    base={dados.totalItens}
                  />
                ))}
              </div>
            </>
          )}

          {temOutros && (
            <>
              <p className="mt-4 mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                Interestadual / rural
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {OUTROS.map((imp) => (
                  <Tile
                    key={imp.chave}
                    rotulo={imp.rotulo}
                    valor={dados[imp.chave]}
                    base={dados.totalItens}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
