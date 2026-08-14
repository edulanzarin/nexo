"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ModuloHeader } from "@/components/modulo-header";
import { useIsFetching } from "@tanstack/react-query";
import { ConfFilterBar } from "@/components/filters/conf-filter-bar";
import { FiltroPendente } from "@/components/filtro-pendente";
import { ProdutividadeMenus, ProdutividadeTabsProvider } from "@/app/folha/produtividade/tabs";
import { useFiltros } from "@/hooks/use-filters";
import { limparEstadoDoModulo } from "@/lib/estado-secao";
import { limparFiltrosDoModulo } from "@/lib/estado-filtros-secao";
import { secaoFolhaAtual } from "@/lib/folha-secoes";
import { dataBR } from "@/lib/format";

export function FolhaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filtros, aplicado } = useFiltros();
  const secao = secaoFolhaAtual(pathname);
  const carregando = useIsFetching() > 0;

  // Estado de tela e memória de filtro vivem pelo MÓDULO: navegar entre seções
  // mantém, e só sair do módulo — este shell some no unmount — descarta.
  useEffect(
    () => () => {
      limparEstadoDoModulo("/folha");
      limparFiltrosDoModulo("/folha");
    },
    []
  );

  const ehProdutividade = secao?.id === "produtividade";
  // Rescisões, como a Produtividade, é o retrato do escritório: empresa opcional.
  const empresaOpcional = ehProdutividade || secao?.id === "rescisoes";
  // Self-contained (não lê o Questor por empresa/período): não mostra a barra de
  // filtro nem espera "aplicar". O Painel (home) carrega sozinho com janelas
  // próprias; o Post Mortem é como as telas internas do RH.
  const semFiltro =
    (secao?.id?.startsWith("painel") || secao?.id?.startsWith("post-mortem")) ?? false;

  return (
    <ProdutividadeTabsProvider>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <ModuloHeader
          titulo={secao?.rotulo ?? "DP"}
          carregando={carregando}
          direita={
            semFiltro ? undefined : (
              <p className="hidden text-xs text-muted sm:block">
                {dataBR(filtros.inicio)} – {dataBR(filtros.fim)}
              </p>
            )
          }
        />

        {semFiltro ? (
          <div className="mt-5 space-y-4">{children}</div>
        ) : (
          <>
            {/* Abas da Produtividade acima da barra de filtros, como na Conciliação. */}
            {ehProdutividade && <ProdutividadeMenus />}

            {/* Rotatividade se lê por empresa (uma por vez); Produtividade é o retrato
                do escritório, então empresa vira filtro opcional (todas por padrão). */}
            <ConfFilterBar mostrarFilial={false} empresaOpcional={empresaOpcional} />

            <div className="mt-5 space-y-4">{aplicado ? children : <FiltroPendente />}</div>
          </>
        )}
      </div>
    </ProdutividadeTabsProvider>
  );
}
