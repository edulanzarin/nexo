"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useCasca } from "./casca-cliente";
import { AssinaturaNavex } from "./marca";
import { MenuUsuario } from "./menu-usuario";
import { Paleta } from "./paleta";

/**
 * O topo das páginas fora dos módulos (o início e o Meu Perfil): a assinatura
 * do NaveX, que leva ao início como a da barra lateral, e o menu da pessoa.
 * Sem barra lateral, é ele que mantém a busca (Ctrl+K) e o menu ao alcance.
 */
export function TopoAvulso({
  className,
  semPaleta,
}: {
  className?: string;
  /** No catálogo: a peça sem a paleta viva, que prenderia o Ctrl+K da página. */
  semPaleta?: boolean;
}) {
  const { usuario } = useCasca();
  return (
    <>
      <header className={cn("flex h-20 items-center gap-3", className)}>
        <Link href="/" aria-label="Início" className="flex items-center rounded-controle">
          <AssinaturaNavex />
        </Link>
        <div className="ml-auto w-[220px]">
          <MenuUsuario usuario={usuario} />
        </div>
      </header>
      {!semPaleta && <Paleta />}
    </>
  );
}
