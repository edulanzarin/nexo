import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icone";

/**
 * A superfície de vidro que guarda um bloco de conteúdo. Hierarquia por
 * superfície: o painel se separa do fundo pela opacidade e pela sombra, e o
 * que está DENTRO dele se separa por fio, não por outra caixa.
 */
export function Painel({
  titulo,
  descricao,
  icone,
  acoes,
  children,
  className,
  corpo,
  rodape,
  ...props
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  icone?: NomeIcone;
  acoes?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Classe do corpo. `p-0` para tabela encostada na borda. */
  corpo?: string;
  rodape?: ReactNode;
} & Omit<ComponentProps<"section">, "title">) {
  const temCabecalho = titulo || acoes;
  return (
    <section className={cn("nx-vidro flex min-w-0 flex-col rounded-painel", className)} {...props}>
      {temCabecalho && (
        <header className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-linha px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {icone && <Icone nome={icone} tamanho={15} className="text-apagado" />}
            <div className="min-w-0">
              {titulo && <h2 className="truncate text-medio font-[600] text-tinta">{titulo}</h2>}
              {descricao && <p className="truncate text-pequeno text-apagado">{descricao}</p>}
            </div>
          </div>
          {acoes && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{acoes}</div>}
        </header>
      )}
      <div className={cn("min-w-0 flex-1 p-4", corpo)}>{children}</div>
      {rodape && <footer className="border-t border-linha px-4 py-2.5">{rodape}</footer>}
    </section>
  );
}

/** Linha de rótulo e valor, para ficha e detalhe em modal. */
export function Par({
  rotulo,
  children,
  className,
}: {
  rotulo: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className="text-pequeno text-apagado">{rotulo}</dt>
      <dd className="min-w-0 text-corpo text-tinta">{children}</dd>
    </div>
  );
}
