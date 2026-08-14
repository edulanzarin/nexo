import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui";
import { num } from "@/lib/format";

/** Tom pela urgência de uma pendência. */
export type PendenciaTone = "critical" | "warning" | "good";

const TINT: Record<PendenciaTone, string> = {
  critical: "bg-critical/12 text-critical",
  warning: "bg-warning/12 text-warning",
  good: "bg-good/12 text-good",
};
// Classes literais (o scanner do Tailwind não enxerga `text-${tone}` montado).
const TEXTO: Record<PendenciaTone, string> = {
  critical: "text-critical",
  warning: "text-warning",
  good: "text-good",
};

/**
 * Card de pendência dos painéis do DP: número grande + detalhe, tom pela
 * urgência, o card inteiro é um link para a tela que resolve. Compartilhado
 * entre o painel do colaborador e o de gestão.
 */
export function CardPendencia({
  titulo,
  icone,
  href,
  valor,
  rotulo,
  detalhe,
  tone,
  indisponivel,
}: {
  titulo: string;
  icone: React.ReactNode;
  href: string;
  valor: number;
  rotulo: string;
  detalhe: string;
  tone: PendenciaTone;
  indisponivel?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <Card padding="md" className="h-full transition-colors group-hover:border-ink/20">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`grid size-8 place-items-center rounded-lg ${TINT[tone]}`}>{icone}</span>
            <span className="text-sm font-medium text-ink">{titulo}</span>
          </div>
          <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
        </div>
        {indisponivel ? (
          <p className="mt-4 text-sm text-muted">Indisponível agora.</p>
        ) : (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-semibold ${valor > 0 ? TEXTO[tone] : "text-ink"}`}>
                {num(valor)}
              </span>
              <span className="text-xs text-muted">{rotulo}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{detalhe}</p>
          </>
        )}
      </Card>
    </Link>
  );
}
