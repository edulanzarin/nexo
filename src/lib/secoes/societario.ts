import { secoesPostMortem } from "./postmortem";
import type { Secao } from "./tipos";

/**
 * Seções do Societário. Hoje só o Post Mortem: o módulo nasceu no nexo2
 * (set/2026) porque o setor passou a preencher relatório de incidente e não
 * tinha onde morar. Sem módulo do setor não há gestor do setor, e o relatório
 * seria lido por quem não é da área.
 *
 * Começar com as duas seções do relatório é o esperado: o módulo é a casa da
 * área, e as telas de contrato, alteração e abertura entram aqui quando
 * existirem. O que o relatório do Societário tem de diferente (nota de
 * gravidade, quem avisou, sem o recorte de pessoal) mora no catálogo de
 * setores, e não nas seções.
 */
export const SECOES_SOCIETARIO: Secao[] = [...secoesPostMortem("societario", "Equipe")];
