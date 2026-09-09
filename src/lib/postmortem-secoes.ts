import { ClipboardList, ClipboardCheck } from "lucide-react";
import type { SecaoFiscal } from "./fiscal-secoes";
import { setorDoModulo } from "./postmortem-setores";

/**
 * As duas seções de Post Mortem que um módulo de setor ganha. Não há módulo
 * "Post Mortem": o relatório mora DENTRO do setor que o preenche, e cada
 * módulo de setor (Fiscal, Contábil, DP, Societário) espalha estas duas na sua
 * lista de seções.
 *
 * São DUAS, e não uma com filtro, porque a permissão aqui é binária: restringir
 * o que se enxerga numa tela é separar em outra seção e não concedê-la (ver
 * [[Posse numa permissão binária é duas seções e recorte por linha]]). O mesmo
 * par que o Painel do DP e do Contábil já usam.
 *
 * - `post-mortem` — o analista: preenche e acompanha OS SEUS. Recorte por linha
 *   (autor), dentro do setor.
 * - `post-mortem-gestao` — o gestor DAQUELE setor: lê todos os relatórios do
 *   setor, de qualquer autor. Não alcança setor nenhum além do seu, porque a
 *   seção vive no módulo dele.
 */
export const SECAO_PM = "post-mortem";
export const SECAO_PM_GESTAO = "post-mortem-gestao";

/**
 * As seções de Post Mortem do módulo, ou vazio se o módulo não tem setor que
 * preencha relatório (RH, Obrigações, Configurações).
 */
export function secoesPostMortem(modulo: string): SecaoFiscal[] {
  const setor = setorDoModulo(modulo);
  if (!setor) return [];
  return [
    {
      id: SECAO_PM,
      icone: ClipboardList,
      rotulo: "Post Mortem",
      path: `/${modulo}/${SECAO_PM}`,
      metrica: false,
      descricao: "Análise de incidente: preencha e acompanhe os seus relatórios",
    },
    {
      id: SECAO_PM_GESTAO,
      icone: ClipboardCheck,
      rotulo: "Post Mortem · Gestão",
      path: `/${modulo}/${SECAO_PM_GESTAO}`,
      metrica: false,
      descricao: `Todos os relatórios do ${setor.rotulo}, de qualquer analista`,
    },
  ];
}

/** A seção de Post Mortem é self-contained: não lê o Questor, não usa filtro. */
export function ehSecaoPostMortem(secaoId: string | undefined): boolean {
  return secaoId === SECAO_PM || secaoId === SECAO_PM_GESTAO;
}
