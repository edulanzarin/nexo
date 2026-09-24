import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icone";
import type { Tom } from "./indicador";

const TONS: Record<Tom, string> = {
  neutro: "bg-poco-forte text-tinta-2",
  ok: "bg-ok-suave text-ok",
  atencao: "bg-atencao-suave text-atencao",
  perigo: "bg-perigo-suave text-perigo",
  rota: "bg-rota-suave text-rota",
  acento: "bg-acento-suave text-acento",
};

/**
 * Fato curto sobre a linha (situação, tipo, vínculo). Estado sempre leva
 * palavra; o ícone é reforço, nunca o único sinal (daltonismo).
 */
export function Selo({
  tom = "neutro",
  icone,
  children,
  className,
  title,
}: {
  tom?: Tom;
  icone?: NomeIcone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-chip px-1.5 text-micro font-[600] whitespace-nowrap",
        TONS[tom],
        className
      )}
    >
      {icone && <Icone nome={icone} tamanho={14} className="size-3" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Bolinha de estado ao lado de um nome. Sem dado, não se desenha. */
export function Ponto({ tom, className }: { tom: Tom; className?: string }) {
  const cor: Record<Tom, string> = {
    neutro: "bg-apagado",
    ok: "bg-ok",
    atencao: "bg-atencao",
    perigo: "bg-perigo",
    rota: "bg-rota",
    acento: "bg-acento-solido",
  };
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", cor[tom], className)} />;
}

/** Atalho de teclado escrito. */
export function Tecla({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-linha-forte bg-poco px-1 font-sans text-micro text-apagado",
        className
      )}
    >
      {children}
    </kbd>
  );
}
