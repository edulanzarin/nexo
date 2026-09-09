"use client";

import { usePathname } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { ModuloHeader } from "@/components/modulo-header";
import { secaoSocietarioAtual } from "@/lib/societario-secoes";

/**
 * Casca do módulo Societário. Self-contained: tudo que ele tem hoje mora no
 * banco do app (o post mortem), então não há barra de filtro nem "Executar" —
 * nada aqui varre o Questor por empresa e período.
 */
export function SocietarioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const secao = secaoSocietarioAtual(pathname);
  const carregando = useIsFetching() > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <ModuloHeader titulo={secao?.rotulo ?? "Societário"} carregando={carregando} />
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}
