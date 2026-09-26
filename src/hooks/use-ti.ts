"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  chavePessoa,
  type EquipamentoDetalhe,
  type EquipamentoLista,
  type MovimentacaoLista,
  type PessoaExterna,
  type PessoaTi,
} from "@/lib/ti-tipos";
import type { AcessoDetalhe, ListaAcessos, RegistroAcesso } from "@/lib/ti-acessos-tipos";
import type { PainelTi } from "@/lib/ti-painel-tipos";
import { useConsulta } from "./use-consulta";

/** As chaves do cache da TI. Quem grava invalida todas de uma vez, menos o Diretório. */
export const CHAVES_TI = {
  lista: "ti-equipamentos",
  detalhe: "ti-equipamento",
  movimentacoes: "ti-movimentacoes",
  pessoas: "ti-pessoas",
  externos: "ti-externos",
  acessos: "ti-acessos",
  acesso: "ti-acesso",
  registro: "ti-acessos-registro",
  painel: "ti-painel",
} as const;

// ── Acessos ──────────────────────────────────────────────────────────────────

export function useAcessos() {
  return useConsulta<ListaAcessos>(CHAVES_TI.acessos, "/api/ti/acessos", { staleTime: 30_000 });
}

export function useAcesso(id: number | null) {
  return useConsulta<AcessoDetalhe>(CHAVES_TI.acesso, id != null ? `/api/ti/acessos/${id}` : null, {
    manterAnterior: false,
  });
}

export function useRegistroAcessos() {
  return useConsulta<RegistroAcesso[]>(CHAVES_TI.registro, "/api/ti/acessos/registro", { staleTime: 15_000 });
}

export function usePainelTi() {
  return useConsulta<PainelTi>(CHAVES_TI.painel, "/api/ti/painel", { staleTime: 30_000 });
}

/**
 * Depois de mexer no cofre, ou de abrir um segredo: a lista, a ficha aberta, o
 * registro e o Painel mudam juntos (abrir a senha é uma linha nova no registro).
 */
export function useRecarregarAcessos() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === CHAVES_TI.acessos ||
          q.queryKey[0] === CHAVES_TI.acesso ||
          q.queryKey[0] === CHAVES_TI.registro ||
          q.queryKey[0] === CHAVES_TI.painel,
      }),
    [qc]
  );
}

/** Quem é de fora do Diretório: o cadastro da TI, ativos e encerrados. */
export function useExternosTi() {
  return useConsulta<PessoaExterna[]>(CHAVES_TI.externos, "/api/ti/externos", { staleTime: 60_000 });
}

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
          q.queryKey[0] === CHAVES_TI.movimentacoes ||
          q.queryKey[0] === CHAVES_TI.externos ||
          q.queryKey[0] === CHAVES_TI.painel ||
          // O cofre lista os equipamentos que dá para vincular.
          q.queryKey[0] === CHAVES_TI.acessos,
      }),
    [qc]
  );
}
