import { ehRespostaLegada } from "@/componentes/produto/rh/experiencia-detalhe";
import { rotuloRecomendacao } from "@/componentes/produto/rh/experiencia-resposta";
import type { ExperienciaItem } from "@/lib/rh-tipos";

/** A mesma chave do modal: abrir a mesma resposta de novo não pede ao servidor. */
export const CHAVE_RESPOSTA = "rh-experiencia-resposta";
export const urlResposta = (id: number) => `/api/rh/experiencia-respostas?id=${id}`;

/**
 * A decisão de um marco respondido, para a coluna da lista. Vem pronta na
 * lista (`montarPainelExperiencia` a tira da pergunta marcada como decisão);
 * a resposta legada traz o código antigo, que ganha o rótulo aqui.
 *
 * `undefined` não acontece mais (a decisão não chega depois da lista), mas o
 * tipo fica aberto para a célula continuar tratando o caso.
 */
export function decisaoDoItem(i: ExperienciaItem): string | null | undefined {
  if (i.status !== "respondido" || !i.resposta) return null;
  if (ehRespostaLegada(i)) return rotuloRecomendacao(i.resposta.recomendacao);
  return i.resposta.recomendacao || null;
}
