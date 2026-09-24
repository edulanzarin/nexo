import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Um bloco do catálogo: o nome da peça, a DECISÃO que ela carrega e a peça
 * viva. Catálogo que só mostra é galeria; o que evita retrabalho é o motivo.
 */
export function Bloco({
  titulo,
  porque,
  children,
  className,
  palco,
}: {
  titulo: string;
  porque: ReactNode;
  children: ReactNode;
  className?: string;
  /** Peça solta vai centrada num palco: a sobra ao lado não parece defeito. */
  palco?: boolean;
}) {
  return (
    <article className={cn("flex min-w-0 flex-col gap-3", className)}>
      <header>
        <h3 className="text-medio font-[620] text-tinta">{titulo}</h3>
        <p className="mt-0.5 max-w-[80ch] text-corpo text-apagado">{porque}</p>
      </header>
      {palco ? (
        <div className="flex min-h-32 items-center justify-center rounded-painel border border-dashed border-linha-forte bg-poco p-6">
          {children}
        </div>
      ) : (
        children
      )}
    </article>
  );
}

export function Familia({ id, titulo, descricao, children }: { id: string; titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-5 border-b border-linha pb-3">
        <h2 className="nx-titulo text-titulo text-tinta">{titulo}</h2>
        <p className="mt-0.5 text-corpo text-apagado">{descricao}</p>
      </div>
      <div className="flex flex-col gap-10">{children}</div>
    </section>
  );
}

/** Rótulo pequeno sobre uma variante dentro do bloco. */
export function Variante({ nome, children, className }: { nome: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <p className="text-micro font-[600] text-apagado">{nome}</p>
      {children}
    </div>
  );
}
