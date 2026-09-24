"use client";

import { gravarPreferencia, usePreferencia } from "./use-preferencia";

/**
 * As últimas seções abertas, com o contexto de cada uma. O início usa para o
 * "continuar de onde parou": o analista volta às mesmas telas das mesmas
 * empresas, e o caminho até elas não precisa passar por menu.
 */
export interface Visita {
  path: string;
  rotulo: string;
  modulo: string;
  icone: string;
  qs: string;
  empresa?: number;
  quando: number;
}

const CHAVE = "visitas";

export function useVisitas(): Visita[] {
  const [lista] = usePreferencia<Visita[]>(CHAVE, []);
  return lista;
}

export function registrarVisita(v: Visita) {
  let atual: Visita[] = [];
  try {
    atual = JSON.parse(window.localStorage.getItem(`navex:${CHAVE}`) ?? "[]");
  } catch {
    atual = [];
  }
  const semRepetir = atual.filter((x) => !(x.path === v.path && x.empresa === v.empresa));
  gravarPreferencia(CHAVE, [v, ...semRepetir].slice(0, 8));
}
