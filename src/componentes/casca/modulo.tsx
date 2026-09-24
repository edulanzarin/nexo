import { Icone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";
import type { Modulo } from "@/lib/modulos";

/**
 * A marca do módulo: o ícone na cor de identidade dele (a paleta é do
 * Eduardo). Identidade não se drena por disponibilidade: módulo "a caminho"
 * continua com a sua cor; só "sem acesso" apagaria, e esse nem aparece.
 */
export function CorModulo({
  modulo,
  tamanho = 28,
  className,
}: {
  modulo: Pick<Modulo, "cor" | "icone" | "titulo">;
  tamanho?: number;
  className?: string;
}) {
  const cor = `var(--id-${modulo.cor})`;
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-[9px] ring-1 ring-inset", className)}
      style={{
        width: tamanho,
        height: tamanho,
        color: cor,
        background: `color-mix(in srgb, ${cor} 15%, transparent)`,
        ["--tw-ring-color" as string]: `color-mix(in srgb, ${cor} 28%, transparent)`,
      }}
    >
      <Icone nome={modulo.icone} tamanho={Math.round(tamanho * 0.56)} />
    </span>
  );
}
