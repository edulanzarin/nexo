"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Rotulado } from "@/componentes/primitivos/campo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { LinkPublico } from "./link-publico";

/*
 * Os endereços do canal de denúncia, numa janela a um clique do cabeçalho da
 * fila. O RH divulga o canal uma vez e trabalha a fila todo dia: o link não
 * ocupa a tela, mas está sempre ali. Vão os dois endereços, o de denunciar e o
 * de acompanhar, porque o cartaz do mural costuma levar os dois.
 */

const TITULO = "Link do Canal de Denúncia";
const DESCRICAO = "Para divulgar no mural, no e-mail ou no comunicado interno";

function Links() {
  return (
    <div className="flex flex-col gap-4">
      <Rotulado rotulo="Fazer uma denúncia">
        <LinkPublico caminho="/denuncia" />
      </Rotulado>
      <Rotulado rotulo="Acompanhar uma denúncia" ajuda="Pede o protocolo e a senha que a pessoa recebe ao enviar.">
        <LinkPublico caminho="/denuncia/acompanhar" />
      </Rotulado>
      <Nota icone="escudo">Quem abre o link não entra com conta e não é identificado.</Nota>
    </div>
  );
}

export function JanelaLinkCanal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={TITULO}
      descricao={DESCRICAO}
      largura="p"
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <Links />
    </Modal>
  );
}

/** A mesma janela parada, para o catálogo. */
export function LinkCanalEstatico() {
  return (
    <PainelModal
      estatico
      largura="p"
      titulo={TITULO}
      descricao={DESCRICAO}
      onFechar={() => {}}
      rodape={<Botao>Fechar</Botao>}
    >
      <Links />
    </PainelModal>
  );
}
