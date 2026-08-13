"use client";

import { cloneElement, forwardRef, isValidElement } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Primitiva de botão: FECHA o tamanho e ABRE só a variante. Antes o projeto tinha
 * três "primário" concorrentes (gradiente, `bg-accent`, `bg-ink`) e dezenas de
 * botões montados na mão. Aqui a cor/intenção é `variant`, a altura é `size`, e a
 * instância nunca redefine `h-*`/cor solta. Ver a nota do Brain de mesmo nome.
 *
 * `asChild` deixa o botão virar outro elemento (ex.: `<Link>` de navegação) sem
 * perder o estilo: `<Button asChild><Link href>…</Link></Button>`.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-all duration-150 [transition-timing-function:var(--ease-spring)] disabled:pointer-events-none disabled:opacity-50";

const VARIANT: Record<ButtonVariant, string> = {
  // Gradiente índigo→violeta com brilho de acento (a classe já traz cor/sombra/hover).
  primary: "btn-accent font-semibold",
  secondary:
    "border border-hairline font-medium text-ink-2 hover:bg-surface-2 hover:text-ink hover:border-[color-mix(in_oklab,var(--accent)_35%,var(--hairline))]",
  ghost: "font-medium text-muted hover:bg-surface-2 hover:text-ink",
  danger:
    "border border-critical/40 font-medium text-critical hover:bg-critical/10",
  // Link não tem caixa: ignora `size`.
  link: "font-medium text-accent underline-offset-2 hover:underline",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-sm",
  md: "h-9 px-3 text-sm",
  lg: "h-10 px-4 text-sm",
};

interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra spinner e desabilita (só na forma `<button>`). */
  loading?: boolean;
  /** Renderiza o filho único no lugar do `<button>`, herdando o estilo. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, asChild, className, children, disabled, ...props },
  ref
) {
  const classes = cn(BASE, variant !== "link" && SIZE[size], VARIANT[variant], className);

  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return cloneElement(child, {
      className: cn(classes, child.props.className),
      ...props,
    } as Record<string, unknown>);
  }

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

/**
 * Botão só-ícone quadrado. `tone` abre a intenção (neutro, perigo, confirmar,
 * com borda) e `size` fecha o tamanho. Cobre fechar-modal, ações de linha, etc.
 */
export type IconButtonTone = "ghost" | "danger" | "good" | "bordered";
export type IconButtonSize = "sm" | "md";

const ICON_TONE: Record<IconButtonTone, string> = {
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "text-muted hover:bg-critical/12 hover:text-critical",
  good: "text-good hover:bg-good/12",
  bordered: "border border-hairline text-ink-2 hover:bg-surface-2 hover:text-ink",
};

const ICON_SIZE: Record<IconButtonSize, string> = {
  sm: "size-8",
  md: "size-9",
};

interface IconButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  tone?: IconButtonTone;
  size?: IconButtonSize;
  /** Obrigatório: sem texto visível, o rótulo acessível vem daqui. */
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ tone = "ghost", size = "md", className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        className={cn(
          "grid shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
          ICON_SIZE[size],
          ICON_TONE[tone],
          className
        )}
        {...props}
      />
    );
  }
);
