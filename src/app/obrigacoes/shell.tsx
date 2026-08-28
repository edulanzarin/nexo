"use client";

import { usePathname } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { ModuloHeader } from "@/components/modulo-header";
import { secaoObrigacoesAtual } from "@/lib/obrigacoes-secoes";

/**
 * Casca do módulo Obrigações. Self-contained como a do RH: a fila já está
 * materializada no banco do app, então não há barra de filtro nem "Executar" —
 * a seção carrega sozinha. O recorte que existe (o setor) é a própria seção.
 */
export function ObrigacoesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const secao = secaoObrigacoesAtual(pathname);
  const carregando = useIsFetching() > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <ModuloHeader titulo={secao?.rotulo ?? "Obrigações"} carregando={carregando} />
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}
