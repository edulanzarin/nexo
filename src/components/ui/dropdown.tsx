"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

interface DropdownProps {
  rotulo: React.ReactNode;
  icone?: React.ReactNode;
  ativo?: boolean;
  /** Largura do PAINEL (lista) — classe Tailwind `w-*`. */
  largura?: string;
  /** Largura FIXA do botão (não cresce com o conteúdo; o rótulo trunca). */
  larguraBotao?: string;
  children: (fechar: () => void) => React.ReactNode;
}

/** Larguras em px das classes usadas, para o painel caber na tela. */
const LARGURAS: Record<string, number> = {
  "w-48": 192,
  "w-60": 240,
  "w-64": 256,
  "w-72": 288,
  "w-80": 320,
  "w-96": 384,
};

export function Dropdown({
  rotulo,
  icone,
  ativo,
  largura = "w-72",
  larguraBotao = "w-52",
  children,
}: DropdownProps) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  // O painel é renderizado em portal no body: os cards usam `anim-fade-up`,
  // que cria contexto de empilhamento, então um z-index interno nunca venceria
  // o card seguinte — e dentro de tabela com overflow o painel seria cortado.
  useLayoutEffect(() => {
    if (!aberto) return;

    const posicionar = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const w = LARGURAS[largura] ?? 288;
      const alturaEstimada = painelRef.current?.offsetHeight ?? 320;
      // Abre para cima quando não há espaço embaixo.
      const abaixo = r.bottom + 8;
      const top =
        abaixo + alturaEstimada > window.innerHeight && r.top > alturaEstimada
          ? r.top - alturaEstimada - 8
          : abaixo;
      setPos({
        top,
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      });
    };

    posicionar();
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto, largura]);

  useEffect(() => {
    if (!aberto) return;
    const onClick = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (ref.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={clsx(
          "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
          larguraBotao,
          ativo
            ? "border-accent/40 bg-accent/10 text-ink"
            : "border-hairline bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
        )}
      >
        {icone}
        <span className="flex-1 truncate text-left">{rotulo}</span>
        <ChevronDown
          className={clsx(
            "size-4 shrink-0 text-muted transition-transform",
            aberto && "rotate-180"
          )}
        />
      </button>

      {aberto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={painelRef}
            style={{ top: pos.top, left: pos.left }}
            className={clsx(
              "anim-scale-in fixed z-[100] overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl shadow-black/20",
              largura
            )}
          >
            {children(() => setAberto(false))}
          </div>,
          document.body
        )}
    </div>
  );
}

export function ItemLista({
  selecionado,
  onClick,
  children,
}: {
  selecionado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2",
        selecionado ? "font-medium text-ink" : "text-ink-2"
      )}
    >
      {children}
    </button>
  );
}
