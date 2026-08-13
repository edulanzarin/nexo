"use client";

import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

/**
 * Card de módulo no launcher. TODOS os módulos aparecem sempre — o que a sessão
 * não libera vem com cadeado e, ao clicar, avisa que falta permissão, em vez de
 * sumir da grade. O bloqueio de verdade continua no servidor (rotas/sessão); aqui
 * é só a porta visual, pra pessoa enxergar que o módulo existe.
 */
export function ModuloCard({
  href,
  icone,
  titulo,
  descricao,
  liberado,
}: {
  href: string;
  icone: string;
  titulo: string;
  descricao?: string;
  liberado: boolean;
}) {
  const conteudo = (
    <>
      <span className="relative">
        <Image
          src={icone}
          alt=""
          width={64}
          height={64}
          className="size-16 transition-transform group-hover:scale-105"
        />
        {!liberado && (
          <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-hairline bg-surface text-muted">
            <Lock className="size-3" strokeWidth={2.5} />
          </span>
        )}
      </span>
      <p className="text-sm font-medium">{titulo}</p>
    </>
  );

  const base =
    "card anim-scale-in group flex flex-col items-center gap-3 px-3 py-6 text-center transition-all duration-200 [transition-timing-function:var(--ease-spring)]";

  if (liberado) {
    return (
      <Link
        href={href}
        title={descricao}
        className={clsx(base, "hover:-translate-y-1 hover:border-accent/40 hover:bg-surface-2")}
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-disabled
      onClick={() => toast.error("Você não tem permissão de acesso a este módulo.")}
      className={clsx(base, "cursor-not-allowed hover:bg-surface-2")}
    >
      {conteudo}
    </button>
  );
}
