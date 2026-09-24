import { cn } from "@/lib/cn";

/**
 * A marca do NaveX: dois traços que se cruzam, o azul passando por baixo do
 * laranja. É a conferência que o sistema faz o dia inteiro, duas fontes se
 * encontrando (fiscal e contábil, extrato e lançamento). Uma afirmação só: o
 * nome já está escrito ao lado, então a marca não repete a inicial.
 *
 * `desenhar` anima os traços uma vez (entrada do login).
 */
export function MarcaNavex({
  tamanho = 24,
  desenhar,
  className,
}: {
  tamanho?: number;
  desenhar?: boolean;
  className?: string;
}) {
  const traco = (atraso: number) =>
    desenhar
      ? {
          strokeDasharray: 40,
          ["--traco" as string]: 40,
          animation: `nx-traco 700ms var(--ease-saida) ${atraso}ms backwards`,
        }
      : undefined;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <g strokeWidth={5} strokeLinecap="round">
        <path d="M7 7 L13.2 13.2" stroke="var(--marca-azul)" style={traco(0)} />
        <path d="M18.8 18.8 L25 25" stroke="var(--marca-azul)" style={traco(120)} />
        <path d="M7 25 L25 7" stroke="var(--marca-laranja)" style={traco(260)} />
      </g>
    </svg>
  );
}

/** Marca e nome, para a moldura. */
export function AssinaturaNavex({ className, compacta }: { className?: string; compacta?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <MarcaNavex tamanho={compacta ? 22 : 24} />
      {!compacta && (
        <span className="text-[17px] leading-none font-[680] tracking-[-0.02em] text-tinta [font-stretch:90%]">
          NaveX
        </span>
      )}
    </span>
  );
}
