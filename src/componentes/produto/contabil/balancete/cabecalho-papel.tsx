import type { ReactNode } from "react";
import { Par } from "@/componentes/primitivos/painel";
import { cn } from "@/lib/cn";
import { documento } from "@/lib/format";

/**
 * O cabeçalho que só existe no papel. Na impressão a moldura some (`nx-sem-papel`)
 * e leva junto a empresa, a filial e o período que estavam no topo; relatório
 * sem dizer de quem, de quando e com que recorte não se entrega a cliente.
 * Então a tela repõe tudo aqui, escondido na tela e visível no papel.
 */
export function CabecalhoPapel({
  titulo,
  empresa,
  itens,
  naTela,
  className,
}: {
  /** O nome do relatório ("Balancete de verificação"). */
  titulo: string;
  empresa: { codigo: number; nome: string; cnpj?: string | null };
  /** Período, filial, filtros da tela e a hora dos dados, já formatados. */
  itens: { rotulo: string; valor: ReactNode }[];
  /** No catálogo: aparece na tela também. */
  naTela?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        naTela ? "flex" : "hidden print:flex",
        "flex-col gap-2 border-b border-linha-forte pb-3",
        className
      )}
    >
      <p className="text-pequeno font-[600] text-apagado">{titulo}</p>
      <h2 className="nx-titulo text-titulo text-tinta">{empresa.nome}</h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        <Par rotulo="Código">
          <span className="num">{String(empresa.codigo)}</span>
        </Par>
        {empresa.cnpj && (
          <Par rotulo="CNPJ">
            <span className="num">{documento(empresa.cnpj)}</span>
          </Par>
        )}
        {itens.map((i) => (
          <Par key={i.rotulo} rotulo={i.rotulo}>
            {i.valor}
          </Par>
        ))}
      </dl>
    </header>
  );
}
