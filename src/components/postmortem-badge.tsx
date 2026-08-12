import clsx from "clsx";
import { CRITICIDADE_ROTULO, type Criticidade, type StatusPM } from "@/lib/folha-postmortem-tipos";

// Rampa verde -> âmbar -> vermelho -> vermelho forte, com os tokens semânticos
// que o tema já expõe (good/warning/critical). O rótulo é a autoridade; a cor
// só reforça.
const CRIT_CLASSE: Record<Criticidade, string> = {
  baixa: "bg-good/10 text-good",
  media: "bg-warning/15 text-warning",
  alta: "bg-critical/10 text-critical",
  critica: "bg-critical/20 text-critical font-semibold ring-1 ring-critical/30",
};

export function CriticidadeBadge({ nivel }: { nivel: Criticidade | null }) {
  if (!nivel) return <span className="text-xs text-muted">—</span>;
  return (
    <span
      className={clsx(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
        CRIT_CLASSE[nivel]
      )}
    >
      {CRITICIDADE_ROTULO[nivel]}
    </span>
  );
}

export function StatusPmBadge({ status }: { status: StatusPM }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
        status === "enviado" ? "bg-ent/12 text-ent" : "bg-surface-2 text-muted"
      )}
    >
      {status === "enviado" ? "Enviado" : "Rascunho"}
    </span>
  );
}
