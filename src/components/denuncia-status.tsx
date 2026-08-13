import { STATUS_DENUNCIA_ROTULO, type StatusDenuncia } from "@/lib/denuncia-tipos";
import { Badge, type BadgeTone } from "@/components/ui";

/** Pílula de status da denúncia — mesmo padrão de badge do resto do app. */
const TOM: Record<StatusDenuncia, BadgeTone> = {
  recebida: "warning",
  em_analise: "ent",
  concluida: "good",
  arquivada: "neutral",
};

export function StatusDenunciaBadge({ status }: { status: StatusDenuncia }) {
  return (
    <Badge tone={TOM[status]} className="shrink-0">
      {STATUS_DENUNCIA_ROTULO[status]}
    </Badge>
  );
}
