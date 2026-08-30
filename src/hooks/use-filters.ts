"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { hojeISO, inicioDoMesISO } from "@/lib/format";
import { registrarNaTrilha } from "@/lib/exportar";
import type { ModuloId } from "@/lib/modulos";
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
/** Módulos cuja trilha aceita o beacon de consulta (os mesmos do `/api/auditoria`). */
const MODULOS_TRILHA: ModuloId[] = ["fiscal", "contabil", "folha", "rh"];

/**
 * O clique no Executar vira UM registro na trilha — não uma requisição, um
 * gesto. A tela que dispara seis consultas com o mesmo filtro continua sendo
 * uma consulta do ponto de vista de quem a pediu, e é assim que a aba No Nexo
 * conta.
 *
 * Mora aqui, e não em cada barra de filtro, porque `executar` é o funil por onde
 * TODA consulta com botão passa nos quatro módulos — instrumentar tela a tela
 * era garantir que a próxima nascesse sem registro.
 *
 * `codigoempresa` só vai quando há UMA empresa: com várias, ou nenhuma, o gesto
 * é do escritório e vale para todos no escopo (a trilha trata empresa nula
 * assim). Best-effort — falha de beacon nunca segura a consulta.
 */
function auditarConsulta(pathname: string, f: FiltrosState): void {
  const modulo = pathname.split("/")[1] as ModuloId;
  if (!MODULOS_TRILHA.includes(modulo)) return;
  const escopo =
    f.empresas.length === 1
      ? `empresa ${f.empresas[0]}`
      : f.empresas.length
        ? `${f.empresas.length} empresas`
        : f.grupos.length
          ? `${f.grupos.length} grupo(s)`
          : "todo o escopo";
  registrarNaTrilha(
    modulo,
    "consulta",
    `${pathname} · ${f.inicio} a ${f.fim} · ${escopo}`,
    f.empresas.length === 1 ? f.empresas[0] : undefined
  );
}

export function useRascunhoFiltros() {
  const pathname = usePathname();
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
  const executar = useCallback(() => {
    auditarConsulta(pathname, rascunho);
    atualizar(rascunho);
  }, [atualizar, rascunho, pathname]);

  return { rascunho, editar, dirty, executar, aplicado };
}
