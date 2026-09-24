import { Selo } from "@/componentes/primitivos/selo";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import type { Tom } from "@/componentes/primitivos/indicador";
import type { SituacaoNota } from "@/lib/types";

/**
 * A situação de uma nota na conferência, com uma fonte só para a linha da
 * tabela, o filtro, o detalhe e a exportação. Rótulo e tom mudam aqui e em
 * nenhum outro lugar.
 *
 * "Em bloco" (consolidada) não é problema: a nota não tem lançamento próprio,
 * mas as contas dela são cobertas pela consolidação do varejo (origem MOV).
 */
export const SITUACAO_NOTA: Record<SituacaoNota, { rotulo: string; tom: Tom; icone: NomeIcone }> = {
  ok: { rotulo: "Correta", tom: "ok", icone: "ok" },
  pendente: { rotulo: "Não contabilizada", tom: "atencao", icone: "pendente" },
  divergente: { rotulo: "Conta errada", tom: "perigo", icone: "alerta" },
  duplicada: { rotulo: "Duplicada", tom: "perigo", icone: "copiar" },
  consolidada: { rotulo: "Em bloco", tom: "rota", icone: "camadas" },
  nao_exige: { rotulo: "Não exige lançamento", tom: "neutro", icone: "circulo" },
  cancelada: { rotulo: "Cancelada", tom: "neutro", icone: "bloqueado" },
};

export function SeloSituacao({ situacao, className }: { situacao: SituacaoNota; className?: string }) {
  const s = SITUACAO_NOTA[situacao];
  return (
    <Selo tom={s.tom} className={className}>
      {s.rotulo}
    </Selo>
  );
}
