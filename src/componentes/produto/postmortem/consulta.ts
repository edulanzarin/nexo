import { SECAO_PM, SECAO_PM_GESTAO } from "@/lib/postmortem-secoes";

/**
 * Chave das listas de post mortem no cache. Criar, salvar, enviar e excluir
 * invalidam por ela, e as duas listas (a minha e a da gestão) caem juntas: o
 * relatório que o analista acabou de enviar tem de aparecer enviado nas duas.
 */
export const CHAVE_PM = "postmortem";

/** A lista da seção: a do analista traz só os dele; a da gestão, o setor inteiro. */
export function urlListaPM(modulo: string, secao: typeof SECAO_PM | typeof SECAO_PM_GESTAO): string {
  return `/api/${modulo}/post-mortem?secao=${secao}`;
}
