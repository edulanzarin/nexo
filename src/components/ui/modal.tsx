"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

/**
 * Casca comum dos modais: portal no `body`, fecha no ESC e no clique do
 * backdrop, trava o scroll do fundo, e a moldura (card + cabeçalho com título
 * e botão de fechar). O corpo é livre (`children`) — cada modal compõe o seu
 * (detalhe, lista, formulário), inclusive as próprias regiões de scroll/rodapé.
 *
 * Nasceu de 4 modais que repetiam essa moldura à mão; modal novo monta em cima
 * daqui em vez de recriar portal/ESC/scroll/backdrop. Ver [[reaproveitar-primitivos]].
 */
export function Modal({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  largura = "max-w-2xl",
  ariaLabel,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** String vira `<h3>` estilizado; um nó é renderizado como veio (o modal
   *  estiliza o próprio título — ex.: nome truncável com selo ao lado). */
  titulo?: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Largura máxima do card (classe Tailwind `max-w-*`). */
  largura?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return createPortal(
    <div
      className="anim-fade-in fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-md"
      onClick={onFechar}
    >
      <div
        className={clsx(
          "anim-scale-in card elev-modal flex max-h-[85vh] w-full flex-col overflow-hidden",
          largura
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {titulo != null && (
          <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-4">
            <div className="min-w-0 flex-1">
              {typeof titulo === "string" ? (
                <h3 className="truncate text-lg font-semibold">{titulo}</h3>
              ) : (
                titulo
              )}
              {subtitulo != null && (
                <p className="mt-0.5 truncate text-xs text-muted">{subtitulo}</p>
              )}
            </div>
            <button
              onClick={onFechar}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </header>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
