"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Empresa, Filial, GrupoEmpresa } from "@/lib/types";
import { mensagemDeErro } from "./mutar";

export async function buscarJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json();
}

/**
 * Consulta de tela. O erro NÃO vira torrada aqui: a tela mostra o `PainelErro`
 * no lugar do conteúdo, com a mensagem do servidor e o botão de tentar de novo.
 * Torrada some; a tela vazia sem motivo fica.
 *
 * A URL entra na chave: trocar o filtro com a mesma chave serviria o cache do
 * filtro anterior, e a tela mentiria em silêncio.
 */
export function useConsulta<T>(
  chave: string,
  url: string | null,
  opcoes: { manterAnterior?: boolean; staleTime?: number; refetchInterval?: number | false } = {}
) {
  return useQuery<T>({
    queryKey: [chave, url],
    queryFn: () => buscarJson<T>(url!),
    enabled: url != null,
    placeholderData: opcoes.manterAnterior === false ? undefined : keepPreviousData,
    staleTime: opcoes.staleTime,
    refetchInterval: opcoes.refetchInterval,
  });
}

/** Empresas que a sessão alcança. Cadastro: muda pouco, fica em cache por 10 min. */
export function useEmpresas() {
  return useQuery<Empresa[]>({
    queryKey: ["empresas"],
    queryFn: () => buscarJson<Empresa[]>("/api/empresas"),
    staleTime: 10 * 60_000,
  });
}

export function useGruposEmpresa() {
  return useQuery<GrupoEmpresa[]>({
    queryKey: ["grupos-empresa"],
    queryFn: () => buscarJson<GrupoEmpresa[]>("/api/grupos-empresa"),
    staleTime: 10 * 60_000,
  });
}

export function useFiliais(empresa: number | null) {
  return useQuery<Filial[]>({
    queryKey: ["filiais", empresa],
    queryFn: () => buscarJson<Filial[]>(`/api/empresas/estabs?empresa=${empresa}`),
    enabled: empresa != null,
    staleTime: 10 * 60_000,
  });
}
