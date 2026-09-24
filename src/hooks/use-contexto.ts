"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { gravarContexto, lerContexto, type Contexto } from "@/lib/contexto";
import { localDoCaminho } from "@/lib/modulos";
import { gravarPreferencia, usePreferencia } from "./use-preferencia";

/**
 * O contexto de trabalho da URL e o jeito de mudá-lo. Mudar escreve na URL por
 * `replaceState` nativo: o Next sincroniza o `useSearchParams` sem refazer o
 * servidor, e a troca de empresa não recarrega a moldura.
 */
export function useContexto() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const contexto = useMemo(() => lerContexto(sp), [sp]);

  const mudar = useCallback(
    (parcial: Partial<Contexto>) => {
      const novo: Contexto = { ...contexto, ...parcial };
      // Trocar de empresa invalida a filial escolhida: o código de filial é da
      // empresa, e o mesmo número em outra empresa é outra filial.
      if (parcial.empresas && parcial.empresas.join() !== contexto.empresas.join() && !parcial.estabs) {
        novo.estabs = [];
      }
      const p = gravarContexto(new URLSearchParams(window.location.search), novo);
      window.history.replaceState(null, "", `${pathname}?${p.toString()}`);
      if (parcial.empresas?.length === 1) lembrarEmpresa(parcial.empresas[0]);
    },
    [contexto, pathname]
  );

  const local = useMemo(() => localDoCaminho(pathname), [pathname]);
  return { contexto, mudar, local, pathname };
}

const RECENTES = "empresas-recentes";

/** As últimas empresas escolhidas, para o topo do seletor e da paleta. */
export function useEmpresasRecentes(): number[] {
  const [lista] = usePreferencia<number[]>(RECENTES, []);
  return lista;
}

function lembrarEmpresa(codigo: number) {
  let atual: number[] = [];
  try {
    atual = JSON.parse(window.localStorage.getItem(`navex:${RECENTES}`) ?? "[]");
  } catch {
    atual = [];
  }
  gravarPreferencia(RECENTES, [codigo, ...atual.filter((c) => c !== codigo)].slice(0, 6));
}
