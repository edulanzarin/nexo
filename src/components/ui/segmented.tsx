"use client";

import { cn } from "@/lib/cn";

/**
 * Controle segmentado genérico — o mesmo padrão aparecia copiado 7× à mão
 * (valor/qtd, entrada/saída, contábil/fiscal…). Trilho translúcido, pastilha
 * ativa que "levanta" com sombra. A variante muda a intenção, não o tamanho.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-lg border border-hairline bg-[var(--seg-bg)] p-0.5 text-xs",
        className
      )}
    >
      {options.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md transition-all duration-150",
              size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1",
              ativo
                ? "bg-[var(--seg-active)] font-medium text-ink shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
