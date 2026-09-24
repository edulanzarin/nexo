/* eslint-disable @next/next/no-img-element -- avatar vem da rota do app, sem otimização */
import { cn } from "@/lib/cn";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const a = partes[0][0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase();
}

/** Foto da pessoa, ou as iniciais quando não há foto. */
export function Avatar({
  nome,
  src,
  tamanho = 28,
  className,
}: {
  nome: string;
  src?: string | null;
  tamanho?: number;
  className?: string;
}) {
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) };
  if (src)
    return (
      <img
        src={src}
        alt=""
        width={tamanho}
        height={tamanho}
        style={estilo}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-linha-forte", className)}
      />
    );
  return (
    <span
      aria-hidden
      style={estilo}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-poco-forte font-[650] text-tinta-2 ring-1 ring-linha-forte",
        className
      )}
    >
      {iniciais(nome)}
    </span>
  );
}
