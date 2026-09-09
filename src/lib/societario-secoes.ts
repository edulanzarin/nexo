import type { SecaoFiscal } from "./fiscal-secoes";
import { secoesPostMortem } from "./postmortem-secoes";

/**
 * Seções do módulo Societário. Hoje só o Post Mortem — o módulo nasceu (set/2026)
 * porque o setor passou a preencher relatório de incidente e não tinha onde
 * morar: sem módulo do setor não há gestor do setor, e o relatório voltaria a
 * ser lido por quem não é da área.
 *
 * Que ele comece com uma seção só é o esperado, não um defeito: o módulo é a
 * casa da área, e as telas de contrato/alteração/abertura entram aqui quando
 * existirem.
 */
export const SECOES_SOCIETARIO: SecaoFiscal[] = [...secoesPostMortem("societario")];

export function secaoSocietarioAtual(pathname: string): SecaoFiscal | undefined {
  return SECOES_SOCIETARIO.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}
