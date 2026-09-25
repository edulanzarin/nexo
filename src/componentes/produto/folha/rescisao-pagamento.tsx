"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { dataBR, hojeISO } from "@/lib/format";
import type { RescisaoItem } from "@/lib/rescisoes-tipos";
import { mutar } from "@/hooks/mutar";
import { DataComPrazo } from "./prazo-dp";

/**
 * Depois de mexer numa rescisão, a fila e os dois painéis do DP contam de
 * novo: o painel guarda "rescisões a pagar" em cache e mostraria o número velho
 * na volta.
 */
export function invalidarRescisoes(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["folha-rescisoes"] }),
    qc.invalidateQueries({ queryKey: ["folha-painel"] }),
    qc.invalidateQueries({ queryKey: ["folha-painel-gestao"] }),
  ]);
}

interface PropsPagamento {
  item: RescisaoItem;
  onFechar: () => void;
}

/**
 * Marca uma rescisão como paga: a data do pagamento (ou da homologação) e uma
 * observação livre. É a marcação que tira o item da fila e para os avisos por
 * e-mail; o Questor não fecha nada sozinho. Fica no banco do app.
 */
export function ModalPagamentoRescisao({ item, onFechar }: { item: RescisaoItem | null; onFechar: () => void }) {
  // Monta a cada abertura: a data nasce hoje e a observação nasce vazia.
  if (!item) return null;
  return <FormularioPagamento key={`${item.codigoempresa}:${item.contrato}`} item={item} onFechar={onFechar} />;
}

/** A mesma janela parada, para o catálogo. */
export function PagamentoRescisaoEstatico({ item }: { item: RescisaoItem }) {
  return <FormularioPagamento item={item} onFechar={() => {}} estatico />;
}

function FormularioPagamento({ item, onFechar, estatico }: PropsPagamento & { estatico?: boolean }) {
  const id = useId();
  const qc = useQueryClient();
  const [data, setData] = useState(hojeISO);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!data || estatico) return;
    setSalvando(true);
    try {
      await mutar("/api/folha/rescisoes/resolver", "POST", {
        codigoempresa: item.codigoempresa,
        codigofunccontr: item.contrato,
        resolvidaEm: data,
        observacao: observacao.trim() || undefined,
      });
      await invalidarRescisoes(qc);
      avisar.ok("Rescisão marcada como paga", item.funcionario);
      onFechar();
    } catch (e) {
      avisar.erro("Não deu para marcar como paga", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const titulo = "Marcar Rescisão como Paga";
  const descricao = `${item.funcionario} · ${item.empresa}`;

  const corpo = (
    <form
      id={id}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <dl className="grid grid-cols-2 gap-3">
        <Par rotulo="Desligamento">
          <span className="num">{dataBR(item.dataDesligamento)}</span>
        </Par>
        <Par rotulo="Prazo de pagamento">
          <DataComPrazo data={item.prazo} dias={item.diasParaPrazo} />
        </Par>
      </dl>
      <Rotulado
        rotulo="Data do pagamento"
        htmlFor={`${id}-data`}
        erro={!data ? "Informe a data do pagamento ou da homologação." : undefined}
      >
        <Campo
          id={`${id}-data`}
          type="date"
          data-autofoco
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-invalid={!data}
          className="w-44"
        />
      </Rotulado>
      <Rotulado rotulo="Observação" htmlFor={`${id}-obs`} ajuda="Opcional.">
        <AreaTexto
          id={`${id}-obs`}
          rows={3}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: pago na folha 60, homologado no sindicato"
        />
      </Rotulado>
    </form>
  );

  const rodape = (
    <>
      <Botao variante="fantasma" onClick={onFechar}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone="certo" type="submit" form={id} carregando={salvando} disabled={!data}>
        Marcar como paga
      </Botao>
    </>
  );

  if (estatico)
    return (
      <PainelModal estatico titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar} largura="p">
        {corpo}
      </PainelModal>
    );
  return (
    <Modal
      aberto
      titulo={titulo}
      descricao={descricao}
      rodape={rodape}
      onFechar={onFechar}
      largura="p"
      fecharNoVeu={false}
    >
      {corpo}
    </Modal>
  );
}
