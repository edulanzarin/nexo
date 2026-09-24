import type { ReactNode } from "react";
import { Icone, type NomeIcone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";
import { dataBR, documento, num } from "@/lib/format";

/** Os módulos que servem notas, cada um pela sua rota (o gate da API é por módulo). */
export type ModuloNotas = "fiscal" | "contabil";

/**
 * Uma parte do detalhe da nota dentro do modal (itens, divergências). Separa
 * por fio e título pequeno: caixa dentro de caixa dentro do modal vira ruído.
 */
export function BlocoDetalhe({
  titulo,
  acoes,
  children,
  className,
}: {
  titulo: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2 border-t border-linha pt-4", className)}>
      <header className="flex min-h-5 flex-wrap items-center justify-between gap-2">
        <h3 className="text-pequeno font-[600] text-tinta-2">{titulo}</h3>
        {acoes}
      </header>
      {children}
    </section>
  );
}

const TONS_DESTAQUE = {
  perigo: { caixa: "border-perigo/25 bg-perigo-suave", titulo: "text-perigo" },
  rota: { caixa: "border-rota/25 bg-rota-suave", titulo: "text-rota" },
  atencao: { caixa: "border-atencao/30 bg-atencao-suave", titulo: "text-atencao" },
} as const;

/**
 * O fato que muda a leitura da nota (lançada duas vezes, entrou em bloco). É o
 * único trecho do detalhe com fundo: é a resposta para "por que esta nota está
 * aqui", e precisa ser a primeira coisa que o olho acha.
 */
export function DestaqueDetalhe({
  titulo,
  icone,
  tom,
  children,
}: {
  titulo: ReactNode;
  icone?: NomeIcone;
  tom: keyof typeof TONS_DESTAQUE;
  children: ReactNode;
}) {
  const t = TONS_DESTAQUE[tom];
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-controle border px-3.5 py-3", t.caixa)}>
      <p className={cn("flex items-center gap-1.5 text-pequeno font-[600]", t.titulo)}>
        {icone && <Icone nome={icone} tamanho={14} />}
        {titulo}
      </p>
      <div className="text-corpo text-tinta-2">{children}</div>
    </div>
  );
}

/** A linha de identificação da nota no topo do modal: espécie, número, data, documento e UF. */
export function legendaNota(n: {
  especie: string;
  numero: number;
  serie: string | null;
  data: string;
  doc?: string | null;
  uf?: string | null;
}): string {
  return [
    n.especie,
    `${num(n.numero)}${n.serie ? ` / ${n.serie}` : ""}`,
    dataBR(n.data),
    n.doc ? documento(n.doc) : null,
    n.uf,
  ]
    .filter(Boolean)
    .join(" · ");
}
