import { cn } from "@/lib/cn";

/**
 * Cartão padrão do sistema. A superfície elevada (fundo, borda, raio, sombra,
 * sheen) mora na classe `.card` do CSS; aqui só se abrem os eixos que variavam à
 * mão pela base: respiro (`padding`), entrada (`animate`), clip de tabela
 * (`overflow`) e realce de acento (`tone`).
 */
export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardAnimate = "fade" | "scale" | "none";

const PAD: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

const ANIM: Record<CardAnimate, string> = {
  fade: "anim-fade-up",
  scale: "anim-scale-in",
  none: "",
};

type CardProps<E extends React.ElementType> = {
  as?: E;
  padding?: CardPadding;
  animate?: CardAnimate;
  overflow?: boolean;
  tone?: "default" | "accent";
} & Omit<React.ComponentPropsWithoutRef<E>, "as">;

export function Card<E extends React.ElementType = "div">({
  as,
  padding = "md",
  animate = "fade",
  overflow,
  tone = "default",
  className,
  ...props
}: CardProps<E>) {
  const Comp = (as ?? "div") as React.ElementType;
  return (
    <Comp
      className={cn(
        "card",
        PAD[padding],
        ANIM[animate],
        overflow && "overflow-hidden",
        tone === "accent" && "border-accent/30 bg-accent/5",
        className
      )}
      {...props}
    />
  );
}
