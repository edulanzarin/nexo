import { cn } from "@/lib/cn";

/**
 * Selo/etiqueta de estado. Unifica os cinco badges one-off (situação, denúncia,
 * post-mortem, selo de empresa…) que tinham raios e tamanhos divergentes. A
 * `tone` carrega a intenção (bom, crítico, aviso, neutro, ou as cores de dado
 * ent/sai); o preenchimento segue sempre a convenção `bg-{tone}/12 text-{tone}`.
 */
export type BadgeTone =
  | "good"
  | "critical"
  | "warning"
  | "neutral"
  | "ent"
  | "sai"
  | "accent";

const TONE: Record<BadgeTone, string> = {
  good: "bg-good/12 text-good",
  critical: "bg-critical/12 text-critical",
  warning: "bg-warning/12 text-warning",
  neutral: "bg-surface-2 text-muted",
  ent: "bg-ent/12 text-ent",
  sai: "bg-sai/12 text-sai",
  accent: "bg-accent/12 text-accent",
};

export function Badge({
  tone = "neutral",
  shape = "soft",
  size = "sm",
  emphasized,
  uppercase,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** `soft` = cantos suaves; `pill` = totalmente arredondado. */
  shape?: "soft" | "pill";
  size?: "xs" | "sm";
  /** Anel + peso semibold, pra o estado que precisa saltar (ex.: "crítica"). */
  emphasized?: boolean;
  uppercase?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        size === "xs" ? "text-[10px]" : "text-[11px]",
        shape === "pill" ? "rounded-full px-2.5 py-0.5" : "rounded px-1.5 py-0.5",
        TONE[tone],
        emphasized && "font-semibold ring-1 ring-inset ring-current/25",
        uppercase && "uppercase tracking-wide",
        className
      )}
    >
      {children}
    </span>
  );
}
