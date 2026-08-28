"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { hojeISO, inicioDoMesISO } from "@/lib/format";
import type { Metrica } from "@/lib/types";

export interface FiltrosState {
  inicio: string;
  fim: string;
  empresas: number[];
  /** Filiais (codigoestab) dentro da empresa; vazio = todas (consolidado). */
  estabs: number[];
  /** Grupos de empresa (Configurações) — o servidor os resolve em empresas. */
  grupos: number[];
  especies: string[];
  metrica: Metrica;
}

/** Assinatura estável de um conjunto de filtros — para comparar aplicado × rascunho. */
function assinatura(f: FiltrosState): string {
  return [
    f.inicio,
    f.fim,
    [...f.empresas].sort((a, b) => a - b).join(","),
    [...f.estabs].sort((a, b) => a - b).join(","),
    [...f.grupos].sort((a, b) => a - b).join(","),
    [...f.especies].sort().join(","),
    f.metrica,
  ].join("|");
}

export function useFiltros() {
  const pathname = usePathname();
  const sp = useSearchParams();

  const filtros = useMemo<FiltrosState>(
    () => ({
      inicio: sp.get("inicio") ?? inicioDoMesISO(),
      fim: sp.get("fim") ?? hojeISO(),
      empresas: (sp.get("empresas") ?? "").split(",").filter(Boolean).map(Number),
      estabs: (sp.get("estabs") ?? "").split(",").filter(Boolean).map(Number),
      grupos: (sp.get("grupos") ?? "").split(",").filter(Boolean).map(Number),
      especies: (sp.get("especies") ?? "").split(",").filter(Boolean),
      metrica: sp.get("metrica") === "qtd" ? "qtd" : "valor",
    }),
    [sp]
  );

  // Marcador de "já executou": só o botão Executar (via `atualizar`) o liga. Antes
  // disso, as telas não consultam nada — ver [[executar-com-botao]].
  const aplicado = sp.get("ap") === "1";

  const atualizar = useCallback(
    (mudancas: Partial<FiltrosState>) => {
      const novo = { ...filtros, ...mudancas };
      const params = new URLSearchParams();
      params.set("inicio", novo.inicio);
      params.set("fim", novo.fim);
      if (novo.empresas.length) params.set("empresas", novo.empresas.join(","));
      if (novo.estabs.length) params.set("estabs", novo.estabs.join(","));
      if (novo.grupos.length) params.set("grupos", novo.grupos.join(","));
      if (novo.especies.length) params.set("especies", novo.especies.join(","));
      if (novo.metrica !== "valor") params.set("metrica", novo.metrica);
      params.set("ap", "1");
      // replaceState nativo: o Next sincroniza useSearchParams e não refaz RSC
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [filtros, pathname]
  );

  /** Query string dos filtros de dados enviada às APIs. */
  const qs = useMemo(() => {
    const params = new URLSearchParams({ inicio: filtros.inicio, fim: filtros.fim });
    if (filtros.empresas.length) params.set("empresas", filtros.empresas.join(","));
    if (filtros.estabs.length) params.set("estabs", filtros.estabs.join(","));
    if (filtros.grupos.length) params.set("grupos", filtros.grupos.join(","));
    if (filtros.especies.length) params.set("especies", filtros.especies.join(","));
    return params.toString();
  }, [filtros]);

  return { filtros, atualizar, qs, aplicado };
}

/**
 * Rascunho de filtros para o padrão "aplicar no botão": o usuário edita à
 * vontade sem disparar consulta; só `executar()` comita para os filtros
 * aplicados (a URL), e é aí que as queries rodam — nada executa sozinho ao
 * mudar empresa/data ([[executar-com-botao]]). Um hook só, reusado pelas duas
 * barras de filtro.
 */
export function useRascunhoFiltros() {
  const { filtros, atualizar, aplicado } = useFiltros();
  const aplicadoSig = assinatura(filtros);

  const [rascunho, setRascunho] = useState<FiltrosState>(filtros);
  const [sig, setSig] = useState(aplicadoSig);
  // Ajuste de estado no render (padrão do React p/ derivar de prop): quando o
  // aplicado muda por fora (navegação, reset), ressincroniza o rascunho.
  if (sig !== aplicadoSig) {
    setSig(aplicadoSig);
    setRascunho(filtros);
  }

  const editar = useCallback(
    (mudancas: Partial<FiltrosState>) => setRascunho((r) => ({ ...r, ...mudancas })),
    []
  );

  const dirty = assinatura(rascunho) !== aplicadoSig;
  const executar = useCallback(() => atualizar(rascunho), [atualizar, rascunho]);

  return { rascunho, editar, dirty, executar, aplicado };
}
