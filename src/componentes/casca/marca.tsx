import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * O logo do NaveX: o monograma NX que o Eduardo desenhou (24/09/2026). O
 * original é um PNG de fundo branco; aqui ele vive como vetor, reconstruído da
 * geometria medida no desenho (retas a 45°, dois cantos arredondados no N e um
 * no traço longo do X), para ficar nítido de 16px ao tamanho do login e trocar de
 * tom com o tema. A fonte fica em `public/marca/navex-original.png`.
 *
 * `tamanho` é a ALTURA: o monograma é largo (962 × 574).
 */
const PECAS = [
  // N: haste com os dois cantos arredondados e a diagonal cortada em esquadro
  { d: "M168 442.7A82.7 82.7 0 0 1 309.2 384.2L686 761L587.5 859.5L303 575L303 934L232 934A64 64 0 0 1 168 870Z", dx: -70, dy: 0 },
  // traço longo do X
  { d: "M502 486L665 486A46 46 0 0 1 697.4 499.4L1130 934L937 934Z", dx: -60, dy: -60 },
  // traço curto do X
  { d: "M923 375L1104 375L853 626L762.5 535.5Z", dx: 60, dy: -60 },
];

export const PROPORCAO_MARCA = 962 / 574;

export function MarcaNavex({
  tamanho = 20,
  entrada,
  className,
}: {
  tamanho?: number;
  /** As três peças entram uma depois da outra (só no login). */
  entrada?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={Math.round(tamanho * PROPORCAO_MARCA)}
      height={tamanho}
      viewBox="168 360 962 574"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {PECAS.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="var(--marca-azul)"
          style={
            entrada
              ? ({
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  animation: `nx-peca 640ms var(--ease-saida) ${120 + i * 140}ms backwards`,
                } as CSSProperties)
              : undefined
          }
        />
      ))}
    </svg>
  );
}

/** Logo e nome, para a moldura. Recolhida, só o logo. */
export function AssinaturaNavex({ className, compacta }: { className?: string; compacta?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MarcaNavex tamanho={compacta ? 18 : 17} />
      {!compacta && (
        <span className="text-[17px] leading-none font-[680] tracking-[-0.02em] text-tinta [font-stretch:90%]">
          NaveX
        </span>
      )}
    </span>
  );
}
