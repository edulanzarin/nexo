import { CRITICIDADE_ROTULO, type Criticidade, type StatusPM } from "@/lib/folha-postmortem-tipos";
import { Badge, type BadgeTone } from "@/components/ui";

// Rampa verde -> âmbar -> vermelho, com os tokens semânticos que o tema já expõe
// (good/warning/critical). O rótulo é a autoridade; a cor só reforça. "Crítica"
// ganha ênfase (anel + peso) pra saltar.
const CRIT_TONE: Record<Criticidade, BadgeTone> = {
  baixa: "good",
  media: "warning",
  alta: "critical",
  critica: "critical",
};

export function CriticidadeBadge({ nivel }: { nivel: Criticidade | null }) {
  if (!nivel) return <span className="text-xs text-muted">—</span>;
  return (
    <Badge tone={CRIT_TONE[nivel]} emphasized={nivel === "critica"}>
      {CRITICIDADE_ROTULO[nivel]}
    </Badge>
  );
}

export function StatusPmBadge({ status }: { status: StatusPM }) {
  return (
    <Badge tone={status === "enviado" ? "ent" : "neutral"}>
      {status === "enviado" ? "Enviado" : "Rascunho"}
    </Badge>
  );
}
