"use client";

import { Undo2, Ban } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CancelamentosResumo, DevolucoesResumo } from "@/lib/types";
import { brl, num } from "@/lib/format";
import { Card } from "@/components/ui";

function pct(parte: number, base: number): string {
  if (base <= 0) return "0%";
  return `${((parte / base) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

interface Sec {
  valor: string;
  rotulo: string;
}

function ResumoCard({
  icone: Icone,
  titulo,
  primaria,
  primariaRotulo,
  sec,
}: {
  icone: LucideIcon;
  titulo: string;
  primaria: string;
  primariaRotulo: string;
  sec: Sec[];
}) {
  return (
    <Card>
      <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
        <Icone className="size-3.5" />
        {titulo}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{primaria}</p>
      <p className="mt-0.5 text-xs text-muted">{primariaRotulo}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        {sec.map((s) => (
          <div key={s.rotulo}>
            <p className="tnum text-sm font-medium">{s.valor}</p>
            <p className="text-[11px] text-muted">{s.rotulo}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Card animate="none">
      <div className="skeleton mb-2 h-3 w-24" />
      <div className="skeleton h-7 w-32" />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        <div className="skeleton h-8" />
        <div className="skeleton h-8" />
      </div>
    </Card>
  );
}

export function ResumoMovimento({
  devol,
  cancel,
  carregando,
}: {
  devol: DevolucoesResumo | undefined;
  cancel: CancelamentosResumo | undefined;
  carregando: boolean;
}) {
  if (carregando || !devol || !cancel) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const valorDevol = devol.ent.valor + devol.sai.valor;
  const qtdDevol = devol.ent.qtd + devol.sai.qtd;
  const fatTotal = devol.faturamentoEnt + devol.faturamentoSai;
  const totalCancel = cancel.ent.canceladas + cancel.sai.canceladas;
  const totalNotas = cancel.ent.total + cancel.sai.total;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ResumoCard
        icone={Undo2}
        titulo="Devoluções"
        primaria={brl(valorDevol)}
        primariaRotulo="valor devolvido no período"
        sec={[
          { valor: `${num(qtdDevol)} ${qtdDevol === 1 ? "nota" : "notas"}`, rotulo: "quantidade" },
          { valor: pct(valorDevol, fatTotal), rotulo: "do movimento" },
        ]}
      />
      <ResumoCard
        icone={Ban}
        titulo="Cancelamentos"
        primaria={num(totalCancel)}
        primariaRotulo={`${totalCancel === 1 ? "nota cancelada" : "notas canceladas"} no período`}
        sec={[
          { valor: pct(totalCancel, totalNotas), rotulo: "taxa de cancelamento" },
          { valor: `${num(totalNotas)} notas`, rotulo: "total lançado" },
        ]}
      />
    </div>
  );
}
