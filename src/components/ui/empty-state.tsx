import { cn } from "@/lib/cn";
import { Card } from "./card";

/**
 * Estado vazio: ícone opcional, título e texto centrados dentro de um cartão.
 * Extrai o padrão `card grid place-items-center … py-16 text-center` que se
 * repetia 25× à mão. Um dos quatro estados de tela que toda seção precisa ter.
 */
export function EmptyState({
  icon,
  titulo,
  descricao,
  acao,
  className,
}: {
  icon?: React.ReactNode;
  titulo: string;
  descricao?: string;
  /** Ação opcional abaixo do texto (ex.: um botão pra limpar filtro). */
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      padding="none"
      className={cn("grid place-items-center gap-3 px-6 py-16 text-center", className)}
    >
      {icon && (
        <span className="grid size-11 place-items-center rounded-2xl bg-surface-2 text-muted">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        {descricao && <p className="mx-auto max-w-sm text-xs text-muted">{descricao}</p>}
      </div>
      {acao}
    </Card>
  );
}
