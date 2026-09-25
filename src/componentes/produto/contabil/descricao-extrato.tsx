import type { ReactNode } from "react";

/**
 * Uma linha do extrato como o banco imprime: o histórico em cima e o
 * complemento embaixo, menor. O histórico diz o tipo do movimento e se repete
 * ("DÉB.TRANSF.CONTAS DIF.TITULARIDADE"); é o complemento ("FAV.: FULANO") que
 * diz para onde vai o lançamento, então ele fica à vista na tabela e não
 * escondido numa dica. Os selos da linha vão ao lado do histórico.
 */
export function DescricaoExtrato({
  descricao,
  complemento,
  children,
}: {
  descricao: string;
  complemento?: string | null;
  children?: ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-col py-1">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-tinta" title={descricao}>
          {descricao}
        </span>
        {children}
      </span>
      {complemento && (
        <span className="min-w-0 truncate text-pequeno text-apagado" title={complemento}>
          {complemento}
        </span>
      )}
    </span>
  );
}
