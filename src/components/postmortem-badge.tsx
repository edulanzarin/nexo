import { CRITICIDADE_ROTULO, rotuloGravidade, type Criticidade, type StatusPM } from "@/lib/postmortem-tipos";
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

/**
 * Nota de gravidade (1 baixo … 5 gravíssimo) do setor que a usa. Mesma rampa da
 * criticidade, para o olho ler as duas escalas junto sem reaprender a cor: 1-2
 * verde, 3 âmbar, 4-5 vermelho, com ênfase no 5.
 */
export function GravidadeBadge({ nota }: { nota: number | null }) {
  if (nota == null) return <span className="text-xs text-muted">—</span>;
  const tone: BadgeTone = nota >= 4 ? "critical" : nota === 3 ? "warning" : "good";
  return (
    <Badge tone={tone} emphasized={nota === 5}>
      {rotuloGravidade(nota)}
    </Badge>
  );
}
