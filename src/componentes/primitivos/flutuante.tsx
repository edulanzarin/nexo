"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type Placement,
} from "@floating-ui/react-dom";
import { useCallback, useEffect, useId, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface PropsGatilho {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog" | "menu" | "listbox";
}

/**
 * A base de tudo que flutua ancorado num botão: seletor, menu, combo.
 *
 * Vai por portal para o <body> porque vidro cria contexto de empilhamento:
 * dentro de um painel com `backdrop-filter`, nenhum z-index faz a lista abrir
 * por cima do painel de baixo. Posição pelo floating-ui (vira para cima perto do
 * rodapé, encosta na borda sem sair da janela).
 */
export function Flutuante({
  gatilho,
  children,
  lado = "bottom-start",
  larguraDaAncora,
  larguraMin,
  papel = "dialog",
  className,
  aberto: abertoControlado,
  onAberto,
}: {
  gatilho: (props: PropsGatilho) => ReactNode;
  children: ReactNode | ((fechar: () => void) => ReactNode);
  lado?: Placement;
  /** A lista acompanha a largura do botão (combo), no mínimo. */
  larguraDaAncora?: boolean;
  larguraMin?: number;
  papel?: "dialog" | "menu" | "listbox";
  className?: string;
  aberto?: boolean;
  onAberto?: (aberto: boolean) => void;
}) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoControlado ?? abertoInterno;
  const setAberto = useCallback(
    (v: boolean) => {
      setAbertoInterno(v);
      onAberto?.(v);
    },
    [onAberto]
  );
  const id = useId();
  // A âncora mora em estado, não em ref: o foco volta para ela ao fechar, e ler
  // ref durante o render quebra o compilador do React.
  const [ancora, setAncora] = useState<HTMLButtonElement | null>(null);

  const { refs, floatingStyles, elements } = useFloating({
    open: aberto,
    placement: lado,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(160, Math.min(availableHeight, 460))}px`,
            minWidth: larguraDaAncora
              ? `${Math.max(rects.reference.width, larguraMin ?? 0)}px`
              : larguraMin
                ? `${larguraMin}px`
                : "",
          });
        },
      }),
    ],
  });

  const fechar = useCallback(() => {
    setAberto(false);
    ancora?.focus();
  }, [setAberto, ancora]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar();
      }
    };
    const aoClicar = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (ancora?.contains(alvo)) return;
      if (elements.floating?.contains(alvo)) return;
      setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("pointerdown", aoClicar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.removeEventListener("pointerdown", aoClicar, true);
    };
  }, [aberto, fechar, ancora, elements.floating, setAberto]);

  const { setReference, setFloating } = refs;
  const ligarAncora = useCallback(
    (el: HTMLButtonElement | null) => {
      setAncora(el);
      setReference(el);
    },
    [setReference]
  );

  return (
    <>
      {gatilho({
        ref: ligarAncora,
        onClick: () => setAberto(!aberto),
        "aria-expanded": aberto,
        "aria-controls": id,
        "aria-haspopup": papel,
      })}
      {aberto && (
        <Portal>
          <div
            ref={setFloating}
            id={id}
            role={papel === "dialog" ? "dialog" : undefined}
            style={floatingStyles}
            className={cn(
              "nx-flutua z-50 flex flex-col overflow-hidden rounded-painel text-corpo",
              "origin-top animate-[nx-aparece_140ms_var(--ease-saida)]",
              className
            )}
          >
            {typeof children === "function" ? children(fechar) : children}
          </div>
        </Portal>
      )}
    </>
  );
}

/** Leva o conteúdo para o <body>. Vidro cria contexto de empilhamento. */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
