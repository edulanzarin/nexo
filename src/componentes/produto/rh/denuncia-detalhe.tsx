"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { AreaTexto, Rotulado } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { Esqueleto, Girando, Nota, PainelErro } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import {
  CATEGORIA_DENUNCIA_ROTULO,
  STATUS_DENUNCIA,
  STATUS_DENUNCIA_ROTULO,
  type DenunciaDetalhe,
  type StatusDenuncia,
} from "@/lib/denuncia-tipos";
import { dataHoraBR } from "@/lib/format";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { ConversaDenuncia } from "./denuncia-conversa";
import { denunciaAberta } from "./denuncia-fila";
import { SeloStatusDenuncia } from "./status-denuncia";

/** Chaves de consulta da fila e do detalhe, as mesmas que a tela usa. */
export const CHAVES_DENUNCIA = { fila: "rh-denuncias", detalhe: "rh-denuncia" } as const;

/**
 * Depois de responder ou mudar a situação, a fila, o detalhe e o Painel do RH
 * contam de novo: o painel guarda "denúncias abertas" em cache e mostraria o
 * número velho na volta.
 */
export function invalidarDenuncias(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: [CHAVES_DENUNCIA.fila] }),
    qc.invalidateQueries({ queryKey: [CHAVES_DENUNCIA.detalhe] }),
    qc.invalidateQueries({ queryKey: ["rh-painel"] }),
  ]);
}

const OPCOES_SITUACAO = STATUS_DENUNCIA.map((s) => ({ valor: s, rotulo: STATUS_DENUNCIA_ROTULO[s] }));

function Cabecalho({ d }: { d: DenunciaDetalhe }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <SeloStatusDenuncia status={d.status} />
      <span>
        {CATEGORIA_DENUNCIA_ROTULO[d.categoria]} · recebida em <span className="num">{dataHoraBR(d.criadoEm)}</span>
      </span>
    </span>
  );
}

/** O corpo do detalhe: a situação (grava no clique), o setor e a conversa. */
function CorpoDenuncia({
  d,
  situacao,
  mudando,
  onSituacao,
}: {
  d: DenunciaDetalhe;
  /** A situação mostrada: a que está gravando, enquanto grava. */
  situacao: StatusDenuncia;
  mudando: boolean;
  onSituacao: (s: StatusDenuncia) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Rotulado
          className="w-full sm:w-auto"
          rotulo={
            <span className="inline-flex items-center gap-1.5">
              Situação
              {mudando && <Girando rotulo="Gravando a situação" className="size-3.5" />}
            </span>
          }
        >
          {/* As quatro lado a lado leem o ciclo inteiro num olhar, mas não cabem
              na janela do celular: lá a escolha vira lista. */}
          <Segmentado
            className="hidden sm:inline-flex"
            rotulo="Situação da denúncia"
            opcoes={OPCOES_SITUACAO}
            valor={situacao}
            onMudar={onSituacao}
          />
          <Combo
            className="sm:hidden"
            rotuloAcessivel="Situação da denúncia"
            opcoes={OPCOES_SITUACAO}
            valor={situacao}
            onMudar={(v) => onSituacao(v as StatusDenuncia)}
          />
        </Rotulado>
        <dl>
          <Par rotulo="Setor envolvido">
            {d.setorEnvolvido ?? <span className="text-apagado">Não informado</span>}
          </Par>
        </dl>
      </div>
      <ConversaDenuncia lado="rh" relato={d.relato} mensagens={d.mensagens} />
    </div>
  );
}

/**
 * O rodapé: a resposta fica fixa embaixo enquanto a conversa rola. Encerrada
 * não aceita resposta (a rota recusa do lado de quem denunciou, e responder
 * algo encerrado confunde quem acompanha), então o rodapé oferece reabrir.
 */
function RodapeDenuncia({
  encerrada,
  resposta,
  onResposta,
  enviando,
  reabrindo,
  onEnviar,
  onReabrir,
  onFechar,
  idResposta,
}: {
  encerrada: boolean;
  resposta: string;
  onResposta: (v: string) => void;
  enviando: boolean;
  reabrindo: boolean;
  onEnviar: () => void;
  onReabrir: () => void;
  onFechar: () => void;
  idResposta: string;
}) {
  if (encerrada)
    return (
      <>
        <Nota className="mr-auto">Denúncia encerrada. Reabra para responder.</Nota>
        <Botao variante="fantasma" onClick={onFechar}>
          Fechar
        </Botao>
        <Botao icone="reabrir" carregando={reabrindo} onClick={onReabrir}>
          Reabrir
        </Botao>
      </>
    );
  return (
    <>
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor={idResposta} className="sr-only">
          Resposta para quem denunciou
        </label>
        <AreaTexto
          id={idResposta}
          rows={3}
          value={resposta}
          onChange={(e) => onResposta(e.target.value)}
          placeholder="Escreva a resposta para quem denunciou"
        />
        <Nota>Quem denunciou só vê a resposta quando consultar o protocolo.</Nota>
      </div>
      <Botao variante="fantasma" onClick={onFechar}>
        Fechar
      </Botao>
      <Botao variante="primario" icone="enviar" carregando={enviando} disabled={!resposta.trim()} onClick={onEnviar}>
        Enviar resposta
      </Botao>
    </>
  );
}

/**
 * O detalhe de uma denúncia na fila do RH: o relato, a conversa, a situação e a
 * resposta. Monta a cada abertura, então a resposta começa vazia.
 */
export function ModalDenuncia({ id, onFechar }: { id: number | null; onFechar: () => void }) {
  if (id == null) return null;
  return <JanelaDenuncia key={id} id={id} onFechar={onFechar} />;
}

function JanelaDenuncia({ id, onFechar }: { id: number; onFechar: () => void }) {
  const qc = useQueryClient();
  const idResposta = useId();
  const res = useConsulta<DenunciaDetalhe>(CHAVES_DENUNCIA.detalhe, `/api/rh/denuncias?id=${id}`, {
    manterAnterior: false,
  });
  const d = res.data;
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState<StatusDenuncia | null>(null);

  async function responder() {
    if (!d || !resposta.trim()) return;
    setEnviando(true);
    try {
      await mutar("/api/rh/denuncias", "PATCH", { id, acao: "responder", corpo: resposta });
      setResposta("");
      await invalidarDenuncias(qc);
      avisar.ok("Resposta enviada");
    } catch (e) {
      avisar.erro("Não deu para enviar a resposta", (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function mudarSituacao(status: StatusDenuncia) {
    if (!d || status === d.status || gravando) return;
    setGravando(status);
    try {
      await mutar("/api/rh/denuncias", "PATCH", { id, acao: "status", status });
      await invalidarDenuncias(qc);
      avisar.ok("Situação alterada");
    } catch (e) {
      avisar.erro("Não deu para mudar a situação", (e as Error).message);
    } finally {
      setGravando(null);
    }
  }

  let corpo: ReactNode;
  if (res.isError)
    corpo = (
      <PainelErro
        titulo="Não deu para abrir a denúncia"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );
  else if (!d)
    corpo = (
      <div aria-busy className="flex flex-col gap-3">
        <Esqueleto className="h-8 w-80" />
        <Esqueleto className="h-24 w-full" />
        <Esqueleto className="h-12 w-2/3" />
      </div>
    );
  else
    corpo = <CorpoDenuncia d={d} situacao={gravando ?? d.status} mudando={gravando != null} onSituacao={mudarSituacao} />;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={<span className="num">{d?.protocolo ?? "Denúncia"}</span>}
      descricao={d ? <Cabecalho d={d} /> : undefined}
      largura="m"
      // Resposta digitada não se perde num clique fora.
      fecharNoVeu={!resposta.trim()}
      rodape={
        d ? (
          <RodapeDenuncia
            encerrada={!denunciaAberta(d.status)}
            resposta={resposta}
            onResposta={setResposta}
            enviando={enviando}
            reabrindo={gravando === "em_analise"}
            onEnviar={responder}
            onReabrir={() => mudarSituacao("em_analise")}
            onFechar={onFechar}
            idResposta={idResposta}
          />
        ) : undefined
      }
    >
      {corpo}
    </Modal>
  );
}

/** A mesma janela parada, para o catálogo: a situação e a resposta mexem só na tela. */
export function DetalheDenunciaEstatico({ detalhe }: { detalhe: DenunciaDetalhe }) {
  const idResposta = useId();
  const [situacao, setSituacao] = useState<StatusDenuncia>(detalhe.status);
  const [resposta, setResposta] = useState("");
  const d = { ...detalhe, status: situacao };
  return (
    <PainelModal
      estatico
      titulo={<span className="num">{d.protocolo}</span>}
      descricao={<Cabecalho d={d} />}
      onFechar={() => {}}
      rodape={
        <RodapeDenuncia
          encerrada={!denunciaAberta(situacao)}
          resposta={resposta}
          onResposta={setResposta}
          enviando={false}
          reabrindo={false}
          onEnviar={() => setResposta("")}
          onReabrir={() => setSituacao("em_analise")}
          onFechar={() => {}}
          idResposta={idResposta}
        />
      }
    >
      <CorpoDenuncia d={d} situacao={situacao} mudando={false} onSituacao={setSituacao} />
    </PainelModal>
  );
}
