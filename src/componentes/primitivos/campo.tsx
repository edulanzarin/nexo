import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icone";

/** A casca de todo controle de texto: mesma altura, mesmo poço, mesmo foco. */
export const CASCA_CONTROLE =
  "h-controle w-full rounded-controle border border-linha bg-poco px-2.5 text-corpo text-tinta " +
  "placeholder:text-apagado transition-[border-color,background-color,box-shadow] duration-150 " +
  "hover:border-linha-forte focus:border-rota focus:bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--anel)] " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-perigo";

export function Campo({
  icone,
  fim,
  className,
  classeCaixa,
  ...props
}: {
  icone?: NomeIcone;
  /** Algo à direita, dentro da casca (unidade, atalho, botão de limpar). */
  fim?: ReactNode;
  classeCaixa?: string;
} & ComponentProps<"input">) {
  if (!icone && !fim) return <input className={cn(CASCA_CONTROLE, "num", className)} {...props} />;
  return (
    <div className={cn("relative w-full", classeCaixa)}>
      {icone && (
        <Icone
          nome={icone}
          tamanho={15}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-apagado"
        />
      )}
      <input className={cn(CASCA_CONTROLE, "num", icone && "pl-8", fim && "pr-9", className)} {...props} />
      {fim && <div className="absolute inset-y-0 right-1 flex items-center">{fim}</div>}
    </div>
  );
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(CASCA_CONTROLE, "h-auto min-h-20 resize-y py-2 leading-5", className)}
      {...props}
    />
  );
}

/**
 * Rótulo + controle + ajuda. A linha do rótulo existe mesmo sem rótulo quando
 * `reservar` está ligado: numa fila de campos, a célula sem rótulo desalinharia
 * o controle dela em relação aos vizinhos.
 */
export function Rotulado({
  rotulo,
  ajuda,
  erro,
  reservar,
  className,
  children,
  htmlFor,
}: {
  rotulo?: ReactNode;
  ajuda?: ReactNode;
  erro?: ReactNode;
  reservar?: boolean;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {(rotulo || reservar) && (
        <label htmlFor={htmlFor} className="h-4 truncate text-pequeno font-[560] text-tinta-2">
          {rotulo}
        </label>
      )}
      {children}
      {erro ? (
        <p className="text-pequeno text-perigo">{erro}</p>
      ) : ajuda ? (
        <p className="text-pequeno text-apagado italic">{ajuda}</p>
      ) : null}
    </div>
  );
}
