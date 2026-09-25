"use client";

import { useCallback, useRef, useState } from "react";
import { useAtivosTi, useEquipamentos, usePessoasTi, useRecarregarTi } from "@/hooks/use-ti";
import { chavePessoa, type EquipamentoLista, type Posse } from "@/lib/ti-tipos";
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
  const ativos = useAtivosTi();
  const recarregar = useRecarregarTi();
  const [ficha, setFicha] = useState<number | null>(null);
  const [form, setForm] = useState<{ alvo: EquipamentoLista | null; voltar?: number } | null>(null);
  const [mov, setMov] = useState<(InicialMovimentar & { voltar?: number }) | null>(null);
  // O cadastro novo abre a ficha dele ao fechar a janela.
  const depois = useRef<number | null>(null);

  /** Está com alguém que não aparece mais no Diretório. Sem o Diretório carregado, ninguém está. */
  const fora = useCallback(
    (p: Posse) => p.destino === "pessoa" && ativos != null && !ativos.has(chavePessoa(p.empresa, p.contrato)),
    [ativos]
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
        inicial={mov ?? { ids: [], destino: "pessoa" }}
        onFeito={recarregar}
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
    fora,
    fichaAberta: ficha,
    abrirFicha: setFicha,
    novo: () => setForm({ alvo: null }),
    movimentar: (inicial: InicialMovimentar) => setMov(inicial),
    elemento,
  };
}
