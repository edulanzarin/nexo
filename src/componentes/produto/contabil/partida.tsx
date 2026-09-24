import { cn } from "@/lib/cn";

/**
 * D ou C, sempre com a palavra no título. É por onde o analista começa a
 * procurar no Questor (o razão separa débito de crédito), então a letra aparece
 * em todo lugar que cita uma conta do plano: na regra do CFOP, na divergência
 * da conferência e na cópia entre empresas.
 */
export function MarcaNatureza({ natureza, className }: { natureza: 1 | -1; className?: string }) {
  return (
    <span
      title={natureza === 1 ? "Débito" : "Crédito"}
      className={cn("font-[650]", natureza === 1 ? "text-serie-1" : "text-serie-2", className)}
    >
      {natureza === 1 ? "D" : "C"}
    </span>
  );
}

/**
 * Um lançamento que o plano espera, numa etiqueta de uma linha: "D 25204
 * Resíduo de madeira". Conta variável é a do fornecedor ou do cliente, que só
 * se conhece na nota: não há número para mostrar.
 */
export function Partida({
  natureza,
  conta,
  variavel,
  descricao,
  className,
}: {
  natureza: 1 | -1;
  conta: number | null;
  variavel?: boolean;
  descricao?: string | null;
  className?: string;
}) {
  return (
    <span
      title={descricao ?? undefined}
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-chip bg-poco-forte px-1.5 text-micro whitespace-nowrap",
        className
      )}
    >
      <MarcaNatureza natureza={natureza} />
      <span className="num text-tinta">{variavel ? "variável" : (conta ?? "sem conta")}</span>
      {descricao && <span className="max-w-40 truncate text-apagado">{descricao}</span>}
    </span>
  );
}
