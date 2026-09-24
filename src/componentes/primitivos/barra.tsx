import { cn } from "@/lib/cn";
import type { Tom } from "./indicador";

const COR: Record<Tom, string> = {
  neutro: "bg-apagado",
  ok: "bg-ok",
  atencao: "bg-atencao",
  perigo: "bg-perigo",
  rota: "bg-rota",
  acento: "bg-acento-solido",
};

/**
 * Barra de proporção dentro de linha (ranking, cobertura). A régua é de quem
 * chama: escale pelo percentil, não pelo máximo, ou 99% das barras ficam no
 * primeiro terço.
 */
export function BarraProporcao({
  valor,
  tom = "rota",
  cor,
  className,
  rotulo,
}: {
  /** De 0 a 1. Acima de 1 satura e ganha a marca de corte. */
  valor: number;
  tom?: Tom;
  /** Cor de dado (var CSS) no lugar do tom: série de gráfico. */
  cor?: string;
  className?: string;
  rotulo?: string;
}) {
  const v = Math.max(0, valor);
  const cheio = Math.min(1, v);
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={cheio}
      aria-label={rotulo}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-poco-forte", className)}
    >
      <div
        className={cn(
          "h-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-saida)]",
          !cor && COR[tom]
        )}
        style={{ transform: `scaleX(${cheio})`, background: cor }}
      />
      {v > 1 && <span className="absolute top-0 right-0 h-full w-0.5 bg-tinta" />}
    </div>
  );
}

/** Barra empilhada de partes (composição): cada parte com a sua cor de série. */
export function BarraComposicao({
  partes,
  className,
}: {
  partes: { valor: number; cor: string; rotulo: string }[];
  className?: string;
}) {
  const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0);
  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full bg-poco-forte", className)}>
      {total > 0 &&
        partes.map((p) => (
          <div
            key={p.rotulo}
            title={p.rotulo}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(Math.max(0, p.valor) / total) * 100}%`, background: p.cor }}
          />
        ))}
    </div>
  );
}
