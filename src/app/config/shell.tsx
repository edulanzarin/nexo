"use client";

import { usePathname } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { ModuloHeader } from "@/components/modulo-header";
import { secaoConfigAtual } from "@/lib/config-secoes";

/**
 * Casca do módulo Configurações. Cada seção é self-contained (config de domínio,
 * sem filtro de empresa/período) — como as telas internas do RH.
 */
export function ConfigShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const secao = secaoConfigAtual(pathname);
  const carregando = useIsFetching() > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <ModuloHeader titulo={secao?.rotulo ?? "Configurações"} carregando={carregando} />
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}
