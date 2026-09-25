"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Placement } from "@floating-ui/react-dom";
import { cn } from "@/lib/cn";
import { Flutuante, type PropsGatilho } from "./flutuante";
import { Icone, type NomeIcone } from "./icone";

export type ItemMenu =
  | {
      tipo?: "acao";
      rotulo: string;
      icone?: NomeIcone;
      /**
       * Imagem no lugar do ícone, quando a identidade não é um ícone do
       * registro (o cubo de cada módulo na troca de módulo).
       */
      marca?: ReactNode;
      detalhe?: string;
      /** Segunda linha, menor: o que a ação faz quando o rótulo não basta. */
      descricao?: string;
      perigo?: boolean;
      desabilitado?: boolean;
      /** Texto do atalho de teclado, só exibido. */
      atalho?: string;
      aoEscolher: () => void;
    }
  | { tipo: "separador" }
  | { tipo: "titulo"; rotulo: string };

/** Lista de ações de um botão. Navega por seta e fecha ao escolher. */
export function Menu({
  gatilho,
  itens,
  lado = "bottom-end",
  larguraMin = 200,
  cabecalho,
}: {
  gatilho: (props: PropsGatilho) => ReactNode;
  itens: ItemMenu[];
  lado?: Placement;
  larguraMin?: number;
  /** Bloco acima das ações (quem está logado, por exemplo). */
  cabecalho?: ReactNode;
}) {
  return (
    <Flutuante papel="menu" gatilho={gatilho} lado={lado} larguraMin={larguraMin}>
      {(fechar) => <ListaMenu itens={itens} fechar={fechar} cabecalho={cabecalho} />}
    </Flutuante>
  );
}

/** O corpo do menu, exportado para o catálogo mostrá-lo aberto. */
export function ListaMenu({
  itens,
  fechar,
  cabecalho,
  autoFoco = true,
}: {
  itens: ItemMenu[];
  fechar: () => void;
  cabecalho?: ReactNode;
  /**
   * Aberto pelo botão, o menu pega o foco para a seta funcionar. Parado no
   * catálogo, pegar o foco rolaria a página até ele.
   */
  autoFoco?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const acoes = itens
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => (it.tipo ?? "acao") === "acao" && !("desabilitado" in it && it.desabilitado));
  const [ativo, setAtivo] = useState(-1);

  useEffect(() => {
    if (autoFoco) ref.current?.focus();
  }, [autoFoco]);

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const pos = acoes.findIndex((a) => a.i === ativo);
      const prox = e.key === "ArrowDown" ? pos + 1 : pos - 1;
      const alvo = acoes[(prox + acoes.length) % acoes.length];
      if (alvo) setAtivo(alvo.i);
    } else if (e.key === "Enter" && ativo >= 0) {
      e.preventDefault();
      const it = itens[ativo];
      if (it && (it.tipo ?? "acao") === "acao" && "aoEscolher" in it) {
        fechar();
        it.aoEscolher();
      }
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      onKeyDown={aoTeclar}
      className="flex min-h-0 flex-col overflow-y-auto p-1 focus:outline-none"
    >
      {cabecalho && <div className="mb-1 border-b border-linha px-2.5 pt-1.5 pb-2">{cabecalho}</div>}
      {itens.map((it, i) => {
        if (it.tipo === "separador") return <div key={i} role="separator" className="my-1 h-px bg-linha" />;
        if (it.tipo === "titulo")
          return (
            <p key={i} className="px-2.5 pt-2 pb-1 text-micro font-semibold text-apagado">
              {it.rotulo}
            </p>
          );
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.desabilitado}
            onMouseEnter={() => setAtivo(i)}
            onClick={() => {
              fechar();
              it.aoEscolher();
            }}
            className={cn(
              "flex min-h-8 w-full items-center gap-2 rounded-controle px-2.5 text-left text-corpo",
              it.descricao && "py-1.5",
              it.perigo ? "text-perigo" : "text-tinta-2",
              ativo === i && (it.perigo ? "bg-perigo-suave" : "bg-poco-forte text-tinta"),
              it.desabilitado && "opacity-45"
            )}
          >
            {it.marca ?? (it.icone && <Icone nome={it.icone} tamanho={15} className={it.perigo ? "" : "text-apagado"} />)}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{it.rotulo}</span>
              {it.descricao && <span className="block truncate text-micro text-apagado">{it.descricao}</span>}
            </span>
            {it.detalhe && <span className="text-pequeno text-apagado">{it.detalhe}</span>}
            {it.atalho && <kbd className="text-micro text-apagado">{it.atalho}</kbd>}
          </button>
        );
      })}
    </div>
  );
}
