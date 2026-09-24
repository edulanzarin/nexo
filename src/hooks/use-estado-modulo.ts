"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useCaminho } from "./use-contexto";

/**
 * Estado de tela que sobrevive à troca de seção DENTRO do módulo: o extrato
 * lido, a prévia casada, a busca da conferência, o resultado já executado.
 * Ir da Conciliação ao Balancete e voltar encontra tudo onde estava; sair do
 * módulo descarta (quem limpa é a moldura do módulo, ao desmontar).
 *
 * Mora num Map de módulo, fora do React Query: é estado de interface, e no
 * cache de consulta uma chave sem observador é coletada sozinha em minutos.
 *
 * A chave é da tela (o caminho da aba) mais o campo, então `busca` da
 * Conferência não vaza para `busca` do Plano.
 */
const valores = new Map<string, unknown>();
const ouvintes = new Set<() => void>();

function avisar() {
  for (const f of ouvintes) f();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export function lerEstadoModulo<T>(chave: string): T | undefined {
  return valores.get(chave) as T | undefined;
}

export function gravarEstadoModulo<T>(chave: string, valor: T): void {
  valores.set(chave, valor);
  avisar();
}

/** Descarta o estado de um módulo inteiro (prefixo "/contabil"). */
export function limparEstadoModulo(prefixo: string): void {
  let mudou = false;
  for (const k of [...valores.keys()]) {
    if (k.startsWith(prefixo)) {
      valores.delete(k);
      mudou = true;
    }
  }
  if (mudou) avisar();
}

export function useEstadoModulo<T>(
  chave: string,
  inicial: T
): [T, (v: T | ((anterior: T) => T)) => void] {
  const valor = useSyncExternalStore(
    assinar,
    () => (valores.has(chave) ? (valores.get(chave) as T) : inicial),
    () => inicial
  );
  const definir = useCallback(
    (v: T | ((anterior: T) => T)) => {
      const anterior = valores.has(chave) ? (valores.get(chave) as T) : inicial;
      const novo = typeof v === "function" ? (v as (a: T) => T)(anterior) : v;
      gravarEstadoModulo(chave, novo);
    },
    // `inicial` entra só como padrão de leitura; mudar a referência dele não
    // cria um estado novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave]
  );
  return [valor, definir];
}

/**
 * Estado da TELA atual (a aba), que sobrevive à troca de seção e cai ao sair do
 * módulo: busca, filtro de situação, página, arquivo lido. A chave leva o
 * caminho da aba, então `busca` de uma tela não vaza para a outra.
 */
export function useEstadoTela<T>(campo: string, inicial: T) {
  const caminho = useCaminho();
  return useEstadoModulo<T>(`${caminho}\u0000${campo}`, inicial);
}
