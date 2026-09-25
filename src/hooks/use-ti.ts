"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  chavePessoa,
  type EquipamentoDetalhe,
  type EquipamentoLista,
  type MovimentacaoLista,
  type PessoaTi,
} from "@/lib/ti-tipos";
import { useConsulta } from "./use-consulta";

/** As chaves do cache da TI. Quem grava invalida as três de uma vez. */
export const CHAVES_TI = {
  lista: "ti-equipamentos",
  detalhe: "ti-equipamento",
  movimentacoes: "ti-movimentacoes",
  pessoas: "ti-pessoas",
} as const;

export function useEquipamentos() {
  return useConsulta<EquipamentoLista[]>(CHAVES_TI.lista, "/api/ti/equipamentos", { staleTime: 30_000 });
}

export function useEquipamento(id: number | null) {
  return useConsulta<EquipamentoDetalhe>(CHAVES_TI.detalhe, id != null ? `/api/ti/equipamentos/${id}` : null, {
    manterAnterior: false,
  });
}

export function useMovimentacoesTi() {
  return useConsulta<MovimentacaoLista[]>(CHAVES_TI.movimentacoes, "/api/ti/movimentacoes", { staleTime: 30_000 });
}

/** O Diretório do RH visto pela TI. Muda pouco: cinco minutos de cache. */
export function usePessoasTi() {
  return useConsulta<PessoaTi[]>(CHAVES_TI.pessoas, "/api/ti/pessoas", { staleTime: 5 * 60_000 });
}

/**
 * Quem está no Diretório hoje, por chave. `null` enquanto carrega ou se o
 * Diretório falhou: aí ninguém é marcado como fora, em vez de todo mundo.
 */
export function useAtivosTi(): Set<string> | null {
  const pessoas = usePessoasTi();
  const d = pessoas.data;
  return useMemo(() => (d ? new Set(d.map((p) => chavePessoa(p.empresa, p.contrato))) : null), [d]);
}

/** Depois de gravar: a lista, a ficha aberta e o registro mudam juntos. */
export function useRecarregarTi() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === CHAVES_TI.lista ||
          q.queryKey[0] === CHAVES_TI.detalhe ||
          q.queryKey[0] === CHAVES_TI.movimentacoes,
      }),
    [qc]
  );
}
