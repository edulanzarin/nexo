import type { SituacaoNota } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui";

export const SIT_ROTULO: Record<SituacaoNota, string> = {
  ok: "Correta",
  divergente: "Conta errada",
  duplicada: "Duplicada",
  consolidada: "Consolidada",
  pendente: "Não contabilizada",
  nao_exige: "Não exige lançamento",
  cancelada: "Cancelada",
};

const SIT_TONE: Record<SituacaoNota, BadgeTone> = {
  ok: "good",
  divergente: "critical",
  duplicada: "sai",
  consolidada: "ent",
  pendente: "warning",
  nao_exige: "neutral",
  cancelada: "neutral",
};

/** Etiqueta da situação de uma nota na Conferência. Uma fonte só para a linha
 *  da tabela e o modal de detalhe. */
export function SituacaoBadge({ situacao }: { situacao: SituacaoNota }) {
  return (
    <Badge tone={SIT_TONE[situacao]} size="xs">
      {SIT_ROTULO[situacao]}
    </Badge>
  );
}
