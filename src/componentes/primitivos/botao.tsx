import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icone";

/**
 * O botão expõe a INTENÇÃO (variante), nunca o tamanho: a altura é a do token
 * `h-controle`, e é isso que deixa botão, campo e seletor alinharem na mesma
 * fila sem ajuste por instância.
 *
 * - primario: a ação da tela (Executar, Salvar). Um por tela, laranja da marca;
 * - secundario: ação de apoio, com casca;
 * - fantasma: ação de baixo peso, sem casca até o hover;
 * - perigo: apaga ou desfaz algo que não volta.
 */
export type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo";

const BASE =
  "relative inline-flex h-controle shrink-0 items-center justify-center gap-1.5 rounded-controle px-3 text-corpo font-[560] whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const VARIANTES: Record<VarianteBotao, string> = {
  primario:
    "bg-acento-solido text-sobre-acento hover:bg-acento-solido-hover " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_18px_-10px_var(--acento-solido)]",
  secundario: "border border-linha-forte bg-poco text-tinta hover:bg-poco-forte",
  fantasma: "text-tinta-2 hover:bg-poco hover:text-tinta",
  perigo: "border border-perigo/30 bg-perigo-suave text-perigo hover:bg-perigo/20",
};

export function classeBotao(variante: VarianteBotao = "secundario", className?: string): string {
  return cn(BASE, VARIANTES[variante], className);
}

interface PropsComuns {
  variante?: VarianteBotao;
  icone?: NomeIcone;
  iconeFim?: NomeIcone;
  /** Troca o ícone por um giro e bloqueia o clique, sem mudar a largura. */
  carregando?: boolean;
  children?: ReactNode;
}

export function Botao({
  variante = "secundario",
  icone,
  iconeFim,
  carregando,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: PropsComuns & ComponentProps<"button">) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={classeBotao(variante, className)}
      {...props}
    >
      {carregando ? (
        <Icone nome="carregando" tamanho={15} />
      ) : icone ? (
        <Icone nome={icone} tamanho={15} />
      ) : null}
      {children}
      {iconeFim && !carregando && <Icone nome={iconeFim} tamanho={15} />}
    </button>
  );
}

/** Mesmo visual, navegando. */
export function BotaoLink({
  variante = "secundario",
  icone,
  iconeFim,
  className,
  children,
  ...props
}: Omit<PropsComuns, "carregando"> & ComponentProps<typeof Link>) {
  return (
    <Link className={classeBotao(variante, className)} {...props}>
      {icone && <Icone nome={icone} tamanho={15} />}
      {children}
      {iconeFim && <Icone nome={iconeFim} tamanho={15} />}
    </Link>
  );
}

/**
 * Botão só de ícone. O rótulo é obrigatório: vira o nome acessível e a dica.
 * `linha` é a versão para dentro de linha de tabela (26px), a única exceção de
 * altura, porque a linha tem 34.
 */
export function BotaoIcone({
  icone,
  rotulo,
  variante = "fantasma",
  linha,
  carregando,
  className,
  type = "button",
  disabled,
  ...props
}: {
  icone: NomeIcone;
  rotulo: string;
  variante?: VarianteBotao;
  linha?: boolean;
  carregando?: boolean;
} & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type={type}
      aria-label={rotulo}
      title={rotulo}
      disabled={disabled || carregando}
      className={classeBotao(
        variante,
        cn("px-0", linha ? "h-controle-p w-controle-p rounded-chip" : "w-controle", className)
      )}
      {...props}
    >
      <Icone nome={carregando ? "carregando" : icone} tamanho={linha ? 14 : 16} />
    </button>
  );
}
