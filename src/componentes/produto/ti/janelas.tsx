"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAbrirDaUrl } from "@/hooks/use-abrir-da-url";
import { CHAVES_TI, useAtivosTi, useEquipamentos, useExternosTi, usePessoasTi, useRecarregarTi } from "@/hooks/use-ti";
import { aRecolher, type EquipamentoLista, type Posse } from "@/lib/ti-tipos";
import { ModalFichaEquipamento } from "./ficha-equipamento";
import { ModalEquipamento } from "./formulario-equipamento";
import { ModalMovimentar, type InicialMovimentar } from "./movimentar";

/**
 * As janelas da TI e a costura entre elas, iguais nas três abas: a ficha abre
 * de qualquer lista, e quem movimenta ou edita a partir da ficha volta para
 * ela, já com o histórico novo. Uma janela por vez: a ficha fecha enquanto a
 * movimentação está aberta, em vez de empilhar uma sobre a outra.
 */
export function useJanelasTi() {
  const lista = useEquipamentos();
  const pessoas = usePessoasTi();
  const externos = useExternosTi();
  const ativos = useAtivosTi();
  const recarregar = useRecarregarTi();
  const qc = useQueryClient();
  // O Painel e a ficha de um acesso abrem o equipamento direto (?abrir=).
  const daUrl = useAbrirDaUrl();
  const [ficha, setFicha] = useState<number | null>(daUrl);
  const [form, setForm] = useState<{ alvo: EquipamentoLista | null; voltar?: number } | null>(null);
  const [mov, setMov] = useState<(InicialMovimentar & { voltar?: number }) | null>(null);
  // O cadastro novo abre a ficha dele ao fechar a janela.
  const depois = useRef<number | null>(null);

  const encerrados = useMemo(
    () => new Set((externos.data ?? []).filter((x) => !x.ativo).map((x) => x.id)),
    [externos.data]
  );

  /** Está com quem precisa devolver; a regra é a mesma do Painel (`aRecolher`). */
  const fora = useCallback((p: Posse) => aRecolher(p, ativos, encerrados), [ativos, encerrados]);

  const recarregarExternos = useCallback(
    () => qc.invalidateQueries({ queryKey: [CHAVES_TI.externos] }),
    [qc]
  );

  const elemento = (
    <>
      <ModalFichaEquipamento
        id={ficha}
        fora={(e) => fora(e.posse)}
        onMovimentar={(e, destino) => {
          setFicha(null);
          setMov({ ids: [e.id], destino, travado: true, voltar: e.id });
        }}
        onEditar={(e) => {
          setFicha(null);
          setForm({ alvo: e, voltar: e.id });
        }}
        onFechar={() => setFicha(null)}
        onApagado={recarregar}
      />
      <ModalEquipamento
        aberto={form != null}
        equipamento={form?.alvo}
        pessoas={pessoas.data}
        externos={externos.data}
        onExternoCriado={recarregarExternos}
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
      <ModalMovimentar
        aberto={mov != null}
        equipamentos={lista.data}
        pessoas={pessoas.data}
        externos={externos.data}
        inicial={mov ?? { ids: [], destino: "pessoa" }}
        onFeito={recarregar}
        onExternoCriado={recarregarExternos}
        onFechar={() => {
          const volta = mov?.voltar ?? null;
          setMov(null);
          if (volta != null) setFicha(volta);
        }}
      />
    </>
  );

  return {
    lista,
    pessoas,
    externos,
    fora,
    recarregar,
    fichaAberta: ficha,
    abrirFicha: setFicha,
    novo: () => setForm({ alvo: null }),
    movimentar: (inicial: InicialMovimentar) => setMov(inicial),
    elemento,
  };
}
