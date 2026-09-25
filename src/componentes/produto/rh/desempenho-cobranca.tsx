"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { dataBR, num } from "@/lib/format";
import type { DesempenhoRodada } from "@/lib/rh-tipos";

/*
 * A confirmação antes de cobrar uma rodada inteira. Um clique manda e-mail aos
 * gestores de todas as avaliações paradas daquela rodada, então a janela diz
 * quantas antes: é o único gesto da tela que escreve para muita gente de uma vez.
 *
 * A contagem é a da rota das rodadas (`aCobrar`), com a mesma regra do servidor:
 * saiu, segue aberta e ninguém respondeu.
 */

const TITULO = "Cobrar Quem Não Respondeu";

const avaliacoes = (n: number) => `${num(n)} ${n === 1 ? "avaliação" : "avaliações"}`;

function CorpoCobranca({ rodada }: { rodada: DesempenhoRodada }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Par rotulo="Criada em">
          <span className="num">{dataBR(rodada.criadoEm)}</span>
        </Par>
        <Par rotulo="Avaliações">
          <span className="num">{num(rodada.avaliacoes)}</span>
        </Par>
        <Par rotulo="Respondidas">
          <span className="num">{num(rodada.respondidas)}</span>
        </Par>
        <Par rotulo="Sem resposta, a cobrar">
          <span className="num font-[600] text-atencao">{num(rodada.aCobrar)}</span>
        </Par>
      </dl>
      <p className="text-corpo text-tinta-2">
        Os gestores do setor de cada uma recebem o mesmo link de novo, como lembrete.
      </p>
      <Nota>Ficam de fora as já respondidas, as encerradas e as que não chegaram a sair.</Nota>
    </div>
  );
}

function Rodape({
  rodada,
  cobrando,
  onConfirmar,
  onFechar,
}: {
  rodada: DesempenhoRodada;
  cobrando?: boolean;
  onConfirmar?: () => void;
  onFechar?: () => void;
}) {
  return (
    <>
      <Botao variante="fantasma" onClick={onFechar} disabled={cobrando}>
        Cancelar
      </Botao>
      <Botao
        variante="primario"
        icone="relogio"
        carregando={cobrando}
        disabled={rodada.aCobrar === 0}
        onClick={onConfirmar}
      >
        Cobrar {avaliacoes(rodada.aCobrar)}
      </Botao>
    </>
  );
}

export function ModalCobrarRodada({
  rodada,
  cobrando,
  onConfirmar,
  onFechar,
}: {
  /** A rodada a cobrar; null fecha a janela. */
  rodada: DesempenhoRodada | null;
  cobrando: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  return (
    <Modal
      aberto={rodada != null}
      onFechar={cobrando ? () => {} : onFechar}
      titulo={TITULO}
      descricao={rodada?.titulo}
      largura="p"
      rodape={rodada && <Rodape rodada={rodada} cobrando={cobrando} onConfirmar={onConfirmar} onFechar={onFechar} />}
    >
      {rodada && <CorpoCobranca rodada={rodada} />}
    </Modal>
  );
}

/** A mesma janela parada, para o catálogo. */
export function CobrarRodadaEstatica({ rodada }: { rodada: DesempenhoRodada }) {
  return (
    <PainelModal
      estatico
      largura="p"
      titulo={TITULO}
      descricao={rodada.titulo}
      onFechar={() => {}}
      rodape={<Rodape rodada={rodada} />}
    >
      <CorpoCobranca rodada={rodada} />
    </PainelModal>
  );
}
