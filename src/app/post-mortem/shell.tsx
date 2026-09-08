"use client";

import { usePathname } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { ModuloHeader } from "@/components/modulo-header";
import { secaoPostMortemAtual } from "@/lib/postmortem-secoes";

/**
 * Casca do módulo Post Mortem. Self-contained como a das Obrigações: o relatório
 * mora no banco do app e o único recorte que existe — o setor — é a própria
 * seção, então não há barra de filtro nem "Executar".
 */
export function PostMortemShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const secao = secaoPostMortemAtual(pathname);
  const carregando = useIsFetching() > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <ModuloHeader
        titulo={secao ? `Post Mortem · ${secao.rotulo}` : "Post Mortem"}
        carregando={carregando}
      />
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}
