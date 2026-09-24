"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferência pessoal que atravessa sessões (barra lateral recolhida, empresas
 * recentes). Vai no localStorage, e todo acesso é protegido: em janela anônima
 * ou com armazenamento bloqueado a leitura falha, e a tela tem que continuar
 * funcionando com o padrão.
 */
const PREFIXO = "navex:";
const ouvintes = new Set<() => void>();
const cache = new Map<string, string | null>();

function ler(chave: string): string | null {
  if (cache.has(chave)) return cache.get(chave)!;
  let v: string | null = null;
  try {
    v = window.localStorage.getItem(PREFIXO + chave);
  } catch {
    v = null;
  }
  cache.set(chave, v);
  return v;
}

function assinar(f: () => void) {
  ouvintes.add(f);
  const aoArmazenar = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIXO)) {
      cache.delete(e.key.slice(PREFIXO.length));
      f();
    }
  };
  window.addEventListener("storage", aoArmazenar);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", aoArmazenar);
  };
}

export function gravarPreferencia<T>(chave: string, valor: T): void {
  const txt = JSON.stringify(valor);
  cache.set(chave, txt);
  try {
    window.localStorage.setItem(PREFIXO + chave, txt);
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
  for (const f of ouvintes) f();
}

export function usePreferencia<T>(chave: string, padrao: T): [T, (v: T) => void] {
  const txt = useSyncExternalStore(
    assinar,
    () => ler(chave),
    () => null
  );
  let valor = padrao;
  if (txt != null) {
    try {
      valor = JSON.parse(txt) as T;
    } catch {
      valor = padrao;
    }
  }
  const definir = useCallback((v: T) => gravarPreferencia(chave, v), [chave]);
  return [valor, definir];
}
