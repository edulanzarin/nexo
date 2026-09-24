"use client";

import { useSyncExternalStore } from "react";

/**
 * Tema noite/dia. A escolha é da pessoa ("sistema" segue o Windows); o
 * atributo `data-tema` no <html> é o que o CSS lê. O script abaixo roda antes
 * da pintura para a tela não nascer no tema errado e piscar.
 */
export type PreferenciaTema = "sistema" | "noite" | "dia";

const CHAVE = "navex:tema";

export const SCRIPT_TEMA = `(function(){try{var p=localStorage.getItem("${CHAVE}");var t=p==="noite"||p==="dia"?p:(matchMedia("(prefers-color-scheme: dark)").matches?"noite":"dia");document.documentElement.dataset.tema=t;}catch(e){document.documentElement.dataset.tema="noite";}})();`;

function aplicar(pref: PreferenciaTema) {
  const t =
    pref === "sistema"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "noite"
        : "dia"
      : pref;
  document.documentElement.dataset.tema = t;
}

const ouvintes = new Set<() => void>();

function lerPreferencia(): PreferenciaTema {
  try {
    const p = window.localStorage.getItem(CHAVE);
    return p === "noite" || p === "dia" ? p : "sistema";
  } catch {
    return "sistema";
  }
}

export function definirTema(pref: PreferenciaTema) {
  try {
    if (pref === "sistema") window.localStorage.removeItem(CHAVE);
    else window.localStorage.setItem(CHAVE, pref);
  } catch {
    /* sem armazenamento: vale até recarregar */
  }
  aplicar(pref);
  for (const f of ouvintes) f();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const aoMudarSistema = () => {
    if (lerPreferencia() === "sistema") aplicar("sistema");
    f();
  };
  mq.addEventListener("change", aoMudarSistema);
  return () => {
    ouvintes.delete(f);
    mq.removeEventListener("change", aoMudarSistema);
  };
}

export function usePreferenciaTema(): PreferenciaTema {
  return useSyncExternalStore(assinar, lerPreferencia, () => "sistema");
}
