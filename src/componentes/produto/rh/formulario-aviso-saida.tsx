"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";

/*
 * Saída do editor com alteração não salva. Dois caminhos levam para fora: o
 * navegador (fechar a aba, recarregar, link externo), que só aceita a pergunta
 * nativa do `beforeunload`, e os links do próprio app (lateral, abas, Voltar),
 * que o App Router troca sem descarregar a página e por isso nunca disparam o
 * `beforeunload`. Esses o hook intercepta no clique e pergunta com o modal.
 *
 * O ouvinte fica na captura da `window`, antes do React: o `Link` do Next
 * navega no onClick dele, e parar o evento ali seria tarde.
 */

const TITULO = "Sair sem Salvar?";
const TEXTO = "As alterações deste formulário ainda não foram salvas e vão se perder.";

export function useAvisoSaida(sujo: boolean) {
  const router = useRouter();
  const [destino, setDestino] = useState<string | null>(null);
  const sujoRef = useRef(sujo);
  useEffect(() => {
    sujoRef.current = sujo;
  });

  useEffect(() => {
    const antesDeDescarregar = (e: BeforeUnloadEvent) => {
      if (!sujoRef.current) return;
      e.preventDefault();
      // Navegador antigo só pergunta com o returnValue preenchido.
      e.returnValue = "";
    };
    const aoClicar = (e: MouseEvent) => {
      if (!sujoRef.current || e.defaultPrevented || e.button !== 0) return;
      // Ctrl/Shift+clique abre em outra aba: o editor continua aqui.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setDestino(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", antesDeDescarregar);
    window.addEventListener("click", aoClicar, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeDescarregar);
      window.removeEventListener("click", aoClicar, true);
    };
  }, []);

  return {
    destino,
    ficar: () => setDestino(null),
    sair: () => {
      const para = destino;
      sujoRef.current = false;
      setDestino(null);
      if (para) router.push(para);
    },
  };
}

export function ModalAvisoSaida({
  aberto,
  onFicar,
  onSair,
  texto = TEXTO,
}: {
  aberto: boolean;
  onFicar: () => void;
  onSair: () => void;
  /** O que se perde, na palavra de quem usa (o cargo, e não "este formulário"). */
  texto?: string;
}) {
  return (
    <Modal
      aberto={aberto}
      onFechar={onFicar}
      titulo={TITULO}
      largura="p"
      rodape={
        <>
          <Botao onClick={onFicar}>Continuar editando</Botao>
          <Botao variante="perigo" icone="sair" onClick={onSair}>
            Sair sem salvar
          </Botao>
        </>
      }
    >
      <p className="text-corpo text-tinta-2">{texto}</p>
    </Modal>
  );
}

/** O mesmo aviso aberto e parado, para o catálogo. */
export function AvisoSaidaEstatico() {
  return (
    <PainelModal
      estatico
      largura="p"
      titulo={TITULO}
      onFechar={() => {}}
      rodape={
        <>
          <Botao>Continuar editando</Botao>
          <Botao variante="perigo" icone="sair">
            Sair sem salvar
          </Botao>
        </>
      }
    >
      <p className="text-corpo text-tinta-2">{TEXTO}</p>
    </PainelModal>
  );
}
