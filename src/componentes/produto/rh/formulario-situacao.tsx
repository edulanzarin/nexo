import type { NomeIcone } from "@/componentes/primitivos/icone";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Selo } from "@/componentes/primitivos/selo";
import type { StatusFormulario } from "@/lib/formularios-tipos";

/**
 * A situação de um formulário. Só o ativo pode ser enviado (a lib recusa os
 * outros), então só ele ganha cor: rascunho e arquivado são o mesmo "não sai",
 * e dar tom de alerta a um rascunho faria a lista parecer cheia de problema.
 */
export const ROTULO_SITUACAO_FORMULARIO: Record<StatusFormulario, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  arquivado: "Arquivado",
};

export const TOM_SITUACAO_FORMULARIO: Record<StatusFormulario, Tom> = {
  rascunho: "neutro",
  ativo: "ok",
  arquivado: "neutro",
};

const ICONE: Record<StatusFormulario, NomeIcone> = {
  rascunho: "pendente",
  ativo: "ok",
  arquivado: "ignorado",
};

/** Ordem de escolha no editor: do começo ao fim da vida do formulário. */
export const SITUACOES_FORMULARIO: StatusFormulario[] = ["rascunho", "ativo", "arquivado"];

export function SeloSituacaoFormulario({ status, className }: { status: StatusFormulario; className?: string }) {
  return (
    <Selo tom={TOM_SITUACAO_FORMULARIO[status]} icone={ICONE[status]} className={className}>
      {ROTULO_SITUACAO_FORMULARIO[status]}
    </Selo>
  );
}
