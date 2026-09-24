"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { BotaoIcone } from "./botao";

export type LarguraModal = "p" | "m" | "g" | "xg";

const LARGURAS: Record<LarguraModal, string> = {
  p: "max-w-md",
  m: "max-w-2xl",
  g: "max-w-4xl",
  xg: "max-w-6xl",
};

/**
 * A APARÊNCIA do modal, sem comportamento. Existe separada para o catálogo
 * mostrar o modal aberto com a mesma peça que a tela usa: uma réplica à mão
 * viraria uma segunda implementação, e é ela que envelhece calada.
 *
 * Teto de altura com o corpo rolando: modal que cresce com o conteúdo empurra o
 * rodapé (e o botão de salvar) para fora da janela.
 */
export function PainelModal({
  titulo,
  descricao,
  children,
  rodape,
  largura = "m",
  onFechar,
  idTitulo,
  className,
  corpo,
  estatico,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: LarguraModal;
  onFechar?: () => void;
  idTitulo?: string;
  className?: string;
  corpo?: string;
  /** No catálogo: sem animação de entrada nem teto de janela. */
  estatico?: boolean;
}) {
  return (
    <div
      className={cn(
        "nx-flutua flex w-full flex-col overflow-hidden rounded-flutua",
        !estatico && "max-h-[min(90dvh,960px)] animate-[nx-modal_220ms_var(--ease-saida)]",
        LARGURAS[largura],
        className
      )}
    >
      <header className="flex items-start gap-3 border-b border-linha px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="nx-titulo truncate text-[17px] leading-6 text-tinta">
            {titulo}
          </h2>
          {descricao && <div className="mt-0.5 text-corpo text-apagado">{descricao}</div>}
        </div>
        {onFechar && <BotaoIcone icone="fechar" rotulo="Fechar" onClick={onFechar} className="-mt-0.5 -mr-1.5" />}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", corpo)}>{children}</div>
      {rodape && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-linha px-5 py-3">
          {rodape}
        </footer>
      )}
    </div>
  );
}

const FOCAVEIS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal: portal, véu, foco preso dentro, Esc e clique no véu fecham, e o foco
 * volta para quem abriu. A rolagem da página trava enquanto ele está aberto.
 */
export function Modal({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "m",
  corpo,
  fecharNoVeu = true,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: LarguraModal;
  corpo?: string;
  /** Formulário com dado digitado não fecha no clique fora. */
  fecharNoVeu?: boolean;
}) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const primeiro = caixa.current?.querySelector<HTMLElement>(
      "[data-autofoco]," + FOCAVEIS.replace("button:not([disabled])", "input:not([disabled])")
    );
    (primeiro ?? caixa.current)?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fecharRef.current();
        return;
      }
      if (e.key !== "Tab" || !caixa.current) return;
      const lista = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (!lista.length) return;
      const ini = lista[0];
      const fim = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === ini) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault();
        ini.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!aberto || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 animate-[nx-veu_200ms_ease-out] bg-[var(--veu)] backdrop-blur-[3px]"
        onClick={fecharNoVeu ? onFechar : undefined}
      />
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="relative flex max-h-full w-full justify-center focus:outline-none"
      >
        <PainelModal
          titulo={titulo}
          descricao={descricao}
          rodape={rodape}
          largura={largura}
          onFechar={onFechar}
          idTitulo={idTitulo}
          corpo={corpo}
        >
          {children}
        </PainelModal>
      </div>
    </div>,
    document.body
  );
}
