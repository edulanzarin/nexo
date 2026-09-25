import type { Tom } from "@/componentes/primitivos/indicador";
import { Selo } from "@/componentes/primitivos/selo";
import { STATUS_DENUNCIA_ROTULO, type StatusDenuncia } from "@/lib/denuncia-tipos";

/**
 * Recebida pede alguém abrir; em análise está com o RH; concluída e arquivada
 * saíram da fila. A mesma cor vale na fila do RH e no acompanhamento de quem
 * denunciou, para os dois lerem a mesma situação.
 */
export const TOM_STATUS_DENUNCIA: Record<StatusDenuncia, Tom> = {
  recebida: "atencao",
  em_analise: "rota",
  concluida: "ok",
  arquivada: "neutro",
};

export function SeloStatusDenuncia({ status, className }: { status: StatusDenuncia; className?: string }) {
  return (
    <Selo tom={TOM_STATUS_DENUNCIA[status]} className={className}>
      {STATUS_DENUNCIA_ROTULO[status]}
    </Selo>
  );
}
