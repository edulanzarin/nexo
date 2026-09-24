import { cn } from "@/lib/cn";

/**
 * Uma conta do plano numa linha de tabela: o número reduzido primeiro, apagado,
 * e a descrição depois. O número vem antes porque é o que se digita no Questor;
 * a descrição é para conferir que é a conta certa. Sem descrição (conta que o
 * servidor não descreveu), fica só o número, que ainda é informação.
 */
export function ContaTexto({
  conta,
  descricao,
  vazio = "Sem conta",
  className,
}: {
  conta: number | null | undefined;
  descricao?: string | null;
  vazio?: string;
  className?: string;
}) {
  if (conta == null) return <span className={cn("text-apagado italic", className)}>{vazio}</span>;
  return (
    <span className={cn("flex min-w-0 items-baseline gap-2", className)} title={descricao ?? undefined}>
      <span className="num shrink-0 text-pequeno font-[600] text-apagado">{conta}</span>
      {descricao && <span className="min-w-0 truncate text-tinta-2">{descricao}</span>}
    </span>
  );
}
