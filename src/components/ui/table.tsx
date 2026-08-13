import { cn } from "@/lib/cn";

/**
 * Primitivas de tabela densa. As sete `*-tabela.tsx` repetiam a mesma moldura
 * (wrapper que rola no X, header hairline, hover de linha, coluna numérica com
 * `tnum`) com pequenas divergências — header sticky às vezes sim, às vezes não;
 * `tnum` ora classe, ora `tabular-nums` cru. Aqui isso vira um padrão só, e cada
 * tabela compõe `Thead/Th/Tr/Td` em cima em vez de recriar a moldura.
 */

export function Table({
  minWidth = "min-w-[640px]",
  recarregando,
  className,
  children,
}: {
  /** Largura mínima antes de rolar no X (classe Tailwind `min-w-*`). */
  minWidth?: string;
  recarregando?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("overflow-x-auto", recarregando && "refetching")}>
      <table className={cn("w-full border-collapse text-sm", minWidth, className)}>
        {children}
      </table>
    </div>
  );
}

/** Cabeçalho: linha hairline em texto miúdo. `sticky` gruda no topo ao rolar. */
export function Thead({
  sticky,
  className,
  children,
}: {
  sticky?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <thead>
      <tr
        className={cn(
          "border-b border-hairline text-xs text-muted",
          sticky && "sticky top-0 z-10 bg-surface",
          className
        )}
      >
        {children}
      </tr>
    </thead>
  );
}

export function Th({
  numeric,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"th"> & { numeric?: boolean }) {
  return (
    <th
      className={cn("whitespace-nowrap px-3 py-2 font-medium", numeric ? "text-right" : "text-left", className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tr({
  clickable,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"tr"> & { clickable?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-hairline/60 last:border-0",
        clickable && "cursor-pointer transition-colors hover:bg-surface-2/60",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({
  numeric,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"td"> & { numeric?: boolean }) {
  return (
    <td className={cn("px-3 py-2.5", numeric && "text-right tnum", className)} {...props}>
      {children}
    </td>
  );
}
