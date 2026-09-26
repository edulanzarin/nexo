"use client";

import { useMemo, useRef, useState } from "react";
import { useAbrirDaUrl } from "@/hooks/use-abrir-da-url";
import { useAcessos, useRecarregarAcessos } from "@/hooks/use-ti";
import type { AcessoLista } from "@/lib/ti-acessos-tipos";
import { ModalFichaAcesso } from "./ficha-acesso";
import { ModalAcesso } from "./formulario-acesso";

/**
 * As janelas do cofre e a costura entre elas, iguais no Cofre e no Registro: a
 * ficha abre de qualquer lista, e quem edita a partir da ficha volta para ela.
 * Uma janela por vez.
 */
export function useJanelasAcessos() {
  const lista = useAcessos();
  const recarregar = useRecarregarAcessos();
  const daUrl = useAbrirDaUrl();
  const [ficha, setFicha] = useState<number | null>(daUrl);
  const [form, setForm] = useState<{ alvo: AcessoLista | null; voltar?: number } | null>(null);
  // O cadastro novo abre a ficha dele ao fechar a janela.
  const depois = useRef<number | null>(null);

  const acessos = lista.data?.acessos;
  const grupos = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const a of acessos ?? []) if (a.grupo && !vistos.has(a.grupo.toLowerCase())) vistos.set(a.grupo.toLowerCase(), a.grupo);
    return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [acessos]);
  const chave = lista.data?.chave ?? true;

  const elemento = (
    <>
      <ModalFichaAcesso
        id={ficha}
        semChave={!chave}
        onEditar={(a) => {
          setFicha(null);
          setForm({ alvo: a, voltar: a.id });
        }}
        onFechar={() => setFicha(null)}
        onApagado={recarregar}
      />
      <ModalAcesso
        aberto={form != null}
        acesso={form?.alvo}
        grupos={grupos}
        equipamentos={lista.data?.equipamentos}
        chave={chave}
        onSalvo={(id) => {
          depois.current = id;
          recarregar();
        }}
        onFechar={() => {
          const volta = depois.current ?? form?.voltar ?? null;
          depois.current = null;
          setForm(null);
          if (volta != null) setFicha(volta);
        }}
      />
    </>
  );

  return {
    lista,
    grupos,
    chave,
    fichaAberta: ficha,
    abrirFicha: setFicha,
    novo: () => setForm({ alvo: null }),
    elemento,
  };
}
