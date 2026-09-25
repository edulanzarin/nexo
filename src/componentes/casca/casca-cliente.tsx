"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ModuloId } from "@/lib/modulos";
import type { UsuarioCasca } from "./menu-usuario";

/**
 * O que a moldura sabe da sessão, no cliente: quem é e o que alcança. Serve a
 * barra lateral, a paleta e o início. É conveniência de desenho: quem tranca é
 * o servidor, em cada página e em cada rota.
 */
export interface DadosCasca {
  usuario: UsuarioCasca;
  /** Seções visíveis por módulo (só os módulos com pelo menos uma). */
  acessos: Partial<Record<ModuloId, string[]>>;
}

const Contexto = createContext<DadosCasca | null>(null);

export function ProvedorCasca({ dados, children }: { dados: DadosCasca; children: ReactNode }) {
  return <Contexto.Provider value={dados}>{children}</Contexto.Provider>;
}

/** A casca quando existe: o catálogo monta peças fora da moldura. */
export function useCascaOpcional(): DadosCasca | null {
  return useContext(Contexto);
}

export function useCasca(): DadosCasca {
  const d = useContext(Contexto);
  if (!d) throw new Error("useCasca fora do ProvedorCasca");
  return d;
}
