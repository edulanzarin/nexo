"use client";

import { useMemo } from "react";
import type { OpcaoPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoModulo } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import type { DpColaborador, DpResumo } from "@/lib/dp-tipos";

/**
 * A pessoa isolada vale para as seis abas da Produtividade do DP: quem escolhe
 * alguém na Visão Geral e abre a aba Folha quer ver a folha dessa pessoa. Por
 * isso a chave é da seção, não da aba (o `useEstadoTela` guardaria uma por
 * aba). Começa em "/folha" para a moldura descartar junto com o resto do
 * módulo quando a pessoa sai dele.
 */
const CHAVE_PESSOA = "/folha/produtividade\u0000pessoa";

/**
 * O resumo do período (ranking, totais e o período anterior), que as seis
 * abas leem. A mesma chave e a mesma URL nas seis: trocar de aba com o mesmo
 * recorte responde do cache.
 */
export function useResumoDp() {
  const { qs } = useExecucao();
  const consulta = useConsulta<DpResumo>(
    "folha-dp-produtividade",
    qs == null ? null : `/api/folha/dp-produtividade?${qs}`
  );
  const d = consulta.data;
  const [pessoaSel, setPessoaSel] = useEstadoModulo<number | null>(CHAVE_PESSOA, null);
  // Quem sumiu do ranking (outro período, outra empresa) deixa de recortar a
  // tela, mas continua guardado: voltar ao recorte anterior o reencontra.
  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );
  return { qs, consulta, d, pessoaSel, pessoa, setPessoaSel };
}

/** "2026-08-01_2026-08-31", para o nome do arquivo exportado. */
export function periodoDoQs(qs: string): string {
  const p = new URLSearchParams(qs);
  return `${p.get("inicio") ?? ""}_${p.get("fim") ?? ""}`;
}

/**
 * As opções do filtro de pessoa: o time na ordem do que a aba conta e o
 * Sistema por último, como no nexo2. Ele entra na lista porque o volume dele
 * é real, mas não é alguém que se procura primeiro.
 */
export function opcoesPessoa(
  ranking: DpColaborador[] | undefined,
  contar: (c: DpColaborador) => number
): OpcaoPessoa<number>[] {
  return [...(ranking ?? [])]
    .sort((a, b) => Number(a.auto) - Number(b.auto) || contar(b) - contar(a) || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ codigo: c.codigo, nome: c.nome, qtd: contar(c), inativo: c.inativo && !c.auto }));
}

/** Situação da pessoa na planilha exportada. */
export const situacaoPessoa = (c: DpColaborador) => (c.auto ? "automático" : c.inativo ? "desligado" : "ativo");

/**
 * Soma do que o ranking conta. É a base das participações ("12% do time"):
 * um lote tocado por duas pessoas conta para as duas no ranking e uma vez no
 * total do escritório, e a participação medida contra o total passaria de 100%
 * somada.
 */
export const somaRanking = (ranking: DpColaborador[] | undefined, contar: (c: DpColaborador) => number) =>
  (ranking ?? []).reduce((a, c) => a + contar(c), 0);
