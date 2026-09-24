"use client";

import { autoUpdate, flip, offset, shift, useFloating, type Placement } from "@floating-ui/react-dom";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Portal } from "./flutuante";

/**
 * Dica no hover e no foco. Só para o que o rótulo não diz: um ícone sem texto,
 * a regra por trás de um número. Nunca guarda informação que a pessoa PRECISA,
 * porque no toque ela não aparece.
 */
export function Dica({
  texto,
  children,
  lado = "top",
  className,
}: {
  texto: ReactNode;
  children: ReactNode;
  lado?: Placement;
  className?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const {
    refs: { setReference, setFloating },
    floatingStyles,
  } = useFloating({
    open: aberta,
    placement: lado,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  return (
    <>
      <span
        ref={setReference}
        aria-describedby={aberta ? id : undefined}
        onMouseEnter={() => setAberta(true)}
        onMouseLeave={() => setAberta(false)}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        className={cn("inline-flex", className)}
      >
        {children}
      </span>
      {aberta && (
        <Portal>
          <div
            ref={setFloating}
            id={id}
            role="tooltip"
            style={floatingStyles}
            className="nx-flutua pointer-events-none z-[60] max-w-72 rounded-controle px-2.5 py-1.5 text-pequeno text-tinta-2 animate-[nx-aparece_120ms_ease-out]"
          >
            {texto}
          </div>
        </Portal>
      )}
    </>
  );
}

/** A mesma caixa, parada, para o catálogo. */
export function DicaEstatica({ children }: { children: ReactNode }) {
  return (
    <div className="nx-flutua inline-block max-w-72 rounded-controle px-2.5 py-1.5 text-pequeno text-tinta-2">
      {children}
    </div>
  );
}
