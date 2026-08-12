import clsx from "clsx";
import { LOGO_SRC, MARCA, marcaPublicaRh } from "@/lib/marca";

/** Logo + nome da marca (login, launcher). Usa `<img>` — evita cache do otimizador do next/image. */
export function LogoMarca({
  size = 36,
  showNome = true,
  nomeClassName,
  className,
}: {
  size?: number;
  showNome?: boolean;
  nomeClassName?: string;
  className?: string;
}) {
  const dim = size >= 36 ? "size-9" : "size-8 rounded-lg";
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_SRC} alt={MARCA} width={size} height={size} className={dim} />
      {showNome && (
        <p className={clsx("text-sm font-semibold tracking-tight", nomeClassName)}>{MARCA}</p>
      )}
    </div>
  );
}

/** Faixa compacta das telas públicas do RH. */
export function MarcaPublicaRh({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2 text-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_SRC} alt={MARCA} width={32} height={32} className="size-8 rounded-lg" />
      <span className="text-sm font-medium">{marcaPublicaRh()}</span>
    </div>
  );
}
