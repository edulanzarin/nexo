"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icone";

/**
 * Mede o item ativo para a marca deslizar até ele. Movimento que responde ao
 * clique: mostra de onde a pessoa saiu e para onde foi.
 */
function useMarca(ativo: string | undefined) {
  const caixa = useRef<HTMLDivElement>(null);
  const [marca, setMarca] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const medir = () => {
      const el = caixa.current?.querySelector<HTMLElement>(`[data-chave="${CSS.escape(ativo ?? "")}"]`);
      setMarca(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (caixa.current) obs.observe(caixa.current);
    return () => obs.disconnect();
  }, [ativo]);
  return { caixa, marca };
}

export interface ItemAba {
  chave: string;
  rotulo: ReactNode;
  /** Com href a aba navega (seção com rota própria); sem, é estado local. */
  href?: string;
  icone?: NomeIcone;
  /** Contagem ao lado do rótulo (pendências da aba, por exemplo). */
  contagem?: number;
}

/** Abas sublinhadas, para ângulos do mesmo trabalho. */
export function Abas({
  itens,
  ativa,
  onMudar,
  className,
  rotulo,
}: {
  itens: ItemAba[];
  ativa: string;
  onMudar?: (chave: string) => void;
  className?: string;
  rotulo?: string;
}) {
  const { caixa, marca } = useMarca(ativa);
  return (
    <div
      ref={caixa}
      role="tablist"
      aria-label={rotulo}
      className={cn("relative flex items-center gap-0.5 overflow-x-auto border-b border-linha", className)}
    >
      {itens.map((it) => {
        const sel = it.chave === ativa;
        const conteudo = (
          <>
            {it.icone && <Icone nome={it.icone} tamanho={15} />}
            {it.rotulo}
            {it.contagem != null && (
              <span
                className={cn(
                  "num rounded-chip px-1.5 text-micro font-semibold",
                  sel ? "bg-acento-suave text-acento" : "bg-poco-forte text-apagado"
                )}
              >
                {it.contagem}
              </span>
            )}
          </>
        );
        const classe = cn(
          "relative flex h-9 shrink-0 items-center gap-1.5 px-3 text-corpo whitespace-nowrap transition-colors",
          sel ? "font-[580] text-tinta" : "text-apagado hover:text-tinta-2"
        );
        return it.href ? (
          <Link
            key={it.chave}
            data-chave={it.chave}
            href={it.href}
            role="tab"
            aria-selected={sel}
            className={classe}
            scroll={false}
          >
            {conteudo}
          </Link>
        ) : (
          <button
            key={it.chave}
            type="button"
            data-chave={it.chave}
            role="tab"
            aria-selected={sel}
            onClick={() => onMudar?.(it.chave)}
            className={classe}
          >
            {conteudo}
          </button>
        );
      })}
      {marca && (
        <span
          aria-hidden
          className="absolute bottom-[-1px] h-[2px] rounded-full bg-acento-solido transition-[transform,width] duration-300 ease-[var(--ease-saida)]"
          style={{ width: marca.w - 16, transform: `translateX(${marca.x + 8}px)` }}
        />
      )}
    </div>
  );
}

export interface OpcaoSegmento<T extends string> {
  valor: T;
  rotulo: ReactNode;
  icone?: NomeIcone;
}

/** Escolha entre poucas opções mutuamente exclusivas (entradas/saídas, valor/quantidade). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onMudar,
  className,
  rotulo,
}: {
  opcoes: OpcaoSegmento<T>[];
  valor: T;
  onMudar: (v: T) => void;
  className?: string;
  rotulo?: string;
}) {
  const { caixa, marca } = useMarca(valor);
  return (
    <div
      ref={caixa}
      role="radiogroup"
      aria-label={rotulo}
      className={cn(
        "relative inline-flex h-controle shrink-0 items-center rounded-controle border border-linha bg-poco p-0.5",
        className
      )}
    >
      {marca && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-[6px] border border-linha-forte bg-vidro-forte shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[transform,width] duration-300 ease-[var(--ease-saida)]"
          style={{ width: marca.w, transform: `translateX(${marca.x - 2}px)`, left: 2 }}
        />
      )}
      {opcoes.map((o) => {
        const sel = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={sel}
            data-chave={o.valor}
            onClick={() => onMudar(o.valor)}
            className={cn(
              "relative z-[1] flex h-full items-center gap-1.5 rounded-[6px] px-2.5 text-pequeno font-[560] whitespace-nowrap transition-colors",
              sel ? "text-tinta" : "text-apagado hover:text-tinta-2"
            )}
          >
            {o.icone && <Icone nome={o.icone} tamanho={14} />}
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
