"use client";

import { useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, PainelErro } from "@/componentes/primitivos/estados";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import { Menu } from "@/componentes/primitivos/menu";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { mutar } from "@/hooks/mutar";
import { useEquipamento } from "@/hooks/use-ti";
import { brl, dataBR, hojeISO } from "@/lib/format";
import {
  CAMPOS_SPEC,
  nomeEquipamento,
  tipoEquipamento,
  type Destino,
  type EquipamentoDetalhe,
  type Posse,
} from "@/lib/ti-tipos";
import { CelulaPosse, HistoricoPosse, IconeTipo } from "./equipamento";

type Acao = { destino: Destino; rotulo: string; icone: NomeIcone };

/**
 * As ações que cabem onde o equipamento está. Do estoque, o normal é entregar;
 * com alguém, é passar adiante ou devolver; da manutenção, é voltar. O resto
 * fica no menu, para a ação comum não disputar espaço com a baixa.
 */
function acoesDaPosse(p: Posse): { principais: Acao[]; menu: Acao[] } {
  const entregar: Acao = { destino: "pessoa", rotulo: "Entregar", icone: "usuario" };
  const transferir: Acao = { destino: "pessoa", rotulo: "Passar para outra pessoa", icone: "transferir" };
  const devolver: Acao = { destino: "estoque", rotulo: "Devolver ao estoque", icone: "estoque" };
  const local: Acao = { destino: "local", rotulo: "Deixar num local", icone: "local" };
  const manutencao: Acao = { destino: "manutencao", rotulo: "Enviar para manutenção", icone: "manutencao" };
  const baixa: Acao = { destino: "baixa", rotulo: "Dar baixa", icone: "bloqueado" };
  switch (p.destino) {
    case "estoque":
      return { principais: [entregar], menu: [local, manutencao, baixa] };
    case "pessoa":
    case "externo":
      return { principais: [transferir, devolver], menu: [local, manutencao, baixa] };
    case "local":
      return { principais: [transferir, devolver], menu: [entregar, manutencao, baixa] };
    case "manutencao":
      return { principais: [{ ...devolver, rotulo: "Voltou da manutenção" }, entregar], menu: [baixa] };
    case "baixa":
      return { principais: [{ ...devolver, rotulo: "Voltar ao estoque" }], menu: [] };
  }
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-pequeno font-[600] text-tinta-2">{titulo}</h3>
      {children}
    </section>
  );
}

const vazio = <span className="text-apagado">—</span>;

/** O miolo da ficha, com o equipamento já carregado. */
function CorpoFicha({
  e,
  fora,
  onMovimentar,
}: {
  e: EquipamentoDetalhe;
  fora: boolean;
  onMovimentar: (destino: Destino) => void;
}) {
  const tipo = tipoEquipamento(e.tipo);
  const { principais, menu } = acoesDaPosse(e.posse);
  const hoje = hojeISO();
  const specs = tipo.specs.filter((c) => e.especificacoes[c]);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-controle border border-linha bg-poco px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-pequeno text-apagado">Com quem está · desde {dataBR(e.desde)}</p>
          <div className="text-medio font-[600]">
            <CelulaPosse posse={e.posse} fora={fora} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {principais.map((a, i) => (
            <Botao
              key={a.rotulo}
              variante={i === 0 ? "primario" : "secundario"}
              icone={a.icone}
              onClick={() => onMovimentar(a.destino)}
            >
              {a.rotulo}
            </Botao>
          ))}
          {menu.length > 0 && (
            <Menu
              gatilho={(p) => (
                <Botao {...p} variante="fantasma" icone="opcoes" aria-label="Mais ações">
                  Mais
                </Botao>
              )}
              itens={menu.map((a) => ({
                rotulo: a.rotulo,
                icone: a.icone,
                perigo: a.destino === "baixa",
                aoEscolher: () => onMovimentar(a.destino),
              }))}
            />
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Secao titulo="Identificação">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Par rotulo="Patrimônio">{e.patrimonio ?? <span className="text-apagado">Sem etiqueta</span>}</Par>
              <Par rotulo="Número de série">{e.numeroSerie ?? vazio}</Par>
              <Par rotulo="Tipo">{tipo.rotulo}</Par>
              <Par rotulo="Marca e modelo">{[e.marca, e.modelo].filter(Boolean).join(" ") || vazio}</Par>
            </dl>
          </Secao>

          {tipo.specs.length > 0 && (
            <Secao titulo="Especificações">
              {specs.length ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {specs.map((c) => (
                    <Par key={c} rotulo={CAMPOS_SPEC[c].rotulo}>
                      {e.especificacoes[c]}
                    </Par>
                  ))}
                </dl>
              ) : (
                <p className="text-corpo text-apagado">Nenhuma especificação cadastrada.</p>
              )}
            </Secao>
          )}

          <Secao titulo="Compra">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Par rotulo="Data">{e.dataCompra ? dataBR(e.dataCompra) : vazio}</Par>
              <Par rotulo="Valor">{e.valorCompra != null ? brl(e.valorCompra) : vazio}</Par>
              <Par rotulo="Fornecedor">{e.fornecedor ?? vazio}</Par>
              <Par rotulo="Nota fiscal">{e.notaFiscal ?? vazio}</Par>
              <Par rotulo="Garantia">
                {e.garantiaAte ? (
                  e.garantiaAte < hoje ? (
                    <Selo tom="perigo">Venceu em {dataBR(e.garantiaAte)}</Selo>
                  ) : (
                    <Selo tom="ok">Até {dataBR(e.garantiaAte)}</Selo>
                  )
                ) : (
                  vazio
                )}
              </Par>
            </dl>
          </Secao>

          {e.observacoes && (
            <Secao titulo="Observações">
              <p className="text-corpo whitespace-pre-line text-tinta-2">{e.observacoes}</p>
            </Secao>
          )}
        </div>

        <Secao titulo="Histórico">
          <HistoricoPosse historico={e.historico} />
        </Secao>
      </div>
    </div>
  );
}

function EsqueletoFicha() {
  return (
    <div className="flex flex-col gap-5">
      <Esqueleto className="h-16 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Esqueleto className="w-1/3" />
          <Esqueleto className="w-2/3" />
          <Esqueleto className="w-1/2" />
        </div>
        <div className="flex flex-col gap-3">
          <Esqueleto className="w-1/2" />
          <Esqueleto className="w-3/4" />
        </div>
      </div>
    </div>
  );
}

interface PropsFicha {
  /** Fora do Diretório: a pessoa que está com ele não aparece mais lá. */
  fora: (e: EquipamentoDetalhe) => boolean;
  onMovimentar: (e: EquipamentoDetalhe, destino: Destino) => void;
  onEditar: (e: EquipamentoDetalhe) => void;
  onFechar: () => void;
  onApagado?: () => void;
}

/**
 * A ficha de um equipamento: com quem está e as ações que cabem ali, o
 * cadastro, e o histórico inteiro ao lado. Apagar só aparece enquanto o
 * equipamento tem apenas o cadastro; depois disso, o fim dele é a baixa.
 */
export function ModalFichaEquipamento({ id, ...props }: PropsFicha & { id: number | null }) {
  const q = useEquipamento(id);
  if (id == null) return null;
  const e = q.data;
  return (
    <JanelaFicha e={e} {...props}>
      {q.isError ? (
        <PainelErro
          titulo="Não deu para abrir o equipamento"
          mensagem={(q.error as Error).message}
          onTentar={() => q.refetch()}
        />
      ) : !e ? (
        <EsqueletoFicha />
      ) : (
        <CorpoFicha e={e} fora={props.fora(e)} onMovimentar={(d) => props.onMovimentar(e, d)} />
      )}
    </JanelaFicha>
  );
}

/** A ficha abrindo, para o catálogo: o esqueleto tem a forma do que vem. */
export function FichaEquipamentoCarregando() {
  const nada = () => {};
  return (
    <JanelaFicha e={undefined} estatico fora={() => false} onMovimentar={nada} onEditar={nada} onFechar={nada}>
      <EsqueletoFicha />
    </JanelaFicha>
  );
}

/** A ficha parada, para o catálogo. */
export function FichaEquipamentoEstatica({ equipamento, fora = false }: { equipamento: EquipamentoDetalhe; fora?: boolean }) {
  return (
    <JanelaFicha
      e={equipamento}
      estatico
      fora={() => fora}
      onMovimentar={() => {}}
      onEditar={() => {}}
      onFechar={() => {}}
    >
      <CorpoFicha e={equipamento} fora={fora} onMovimentar={() => {}} />
    </JanelaFicha>
  );
}

function JanelaFicha({
  e,
  children,
  estatico,
  onEditar,
  onFechar,
  onApagado,
}: PropsFicha & { e: EquipamentoDetalhe | undefined; children: ReactNode; estatico?: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    if (!e) return;
    setApagando(true);
    try {
      await mutar(`/api/ti/equipamentos/${e.id}`, "DELETE");
      avisar.ok("Equipamento apagado");
      onApagado?.();
      onFechar();
    } catch (err) {
      avisar.erro((err as Error).message);
    } finally {
      setApagando(false);
    }
  }

  const titulo = e ? (
    <span className="flex min-w-0 items-center gap-2.5">
      <IconeTipo tipo={e.tipo} className="size-7" />
      <span className="truncate">{nomeEquipamento(e)}</span>
    </span>
  ) : (
    "Equipamento"
  );
  const descricao = e ? [e.patrimonio ?? "Sem etiqueta", e.numeroSerie && `Série ${e.numeroSerie}`].filter(Boolean).join(" · ") : undefined;

  const rodape = (
    <>
      {e &&
        e.movimentacoes <= 1 &&
        (confirmando ? (
          <Botao variante="perigo" icone="apagar" carregando={apagando} onClick={apagar} className="mr-auto">
            Confirmar exclusão
          </Botao>
        ) : (
          <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)} className="mr-auto">
            Apagar
          </Botao>
        ))}
      <Botao variante="fantasma" onClick={onFechar}>
        Fechar
      </Botao>
      <Botao variante="secundario" icone="editar" disabled={!e} onClick={() => e && onEditar(e)}>
        Editar cadastro
      </Botao>
    </>
  );

  if (estatico)
    return (
      <PainelModal estatico largura="g" titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar}>
        {children}
      </PainelModal>
    );
  return (
    <Modal aberto largura="g" titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar}>
      {children}
    </Modal>
  );
}
