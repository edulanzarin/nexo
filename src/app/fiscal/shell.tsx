"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useEffect } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { ModuloHeader } from "@/components/modulo-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { FiltroPendente } from "@/components/filtro-pendente";
import { useFiltros } from "@/hooks/use-filters";
import { limparEstadoDoModulo } from "@/lib/estado-secao";
import { limparFiltrosDoModulo } from "@/lib/estado-filtros-secao";
import { abaFiscalAtual, abasFiscalDaSecao, secaoAtual } from "@/lib/fiscal-secoes";
import { dataBR } from "@/lib/format";

export function FiscalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const { filtros, aplicado } = useFiltros();
  const secao = secaoAtual(pathname);
  const abas = abasFiscalDaSecao(pathname);
  const aba = abaFiscalAtual(pathname);
  const carregando = useIsFetching() > 0;

  // Trocar de aba leva os filtros junto (eles estão na URL), menos o marcador de
  // executado: cada aba tem a sua varredura e só roda quando o usuário mandar —
  // estar no mesmo menu não a dispara ([[executar-com-botao]]).
  const tabParams = new URLSearchParams(sp.toString());
  tabParams.delete("ap");
  const tabQs = tabParams.toString();
  const suffix = tabQs ? `?${tabQs}` : "";

  // Estado de tela e memória de filtro vivem pelo MÓDULO: navegar entre seções
  // mantém, e só sair do módulo — este shell some no unmount — descarta.
  useEffect(
    () => () => {
      limparEstadoDoModulo("/fiscal");
      limparFiltrosDoModulo("/fiscal");
    },
    []
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <ModuloHeader
        titulo={secao?.rotulo ?? "Fiscal"}
        carregando={carregando}
        direita={
          <p className="hidden text-xs text-muted sm:block">
            {dataBR(filtros.inicio)} – {dataBR(filtros.fim)}
          </p>
        }
      />

      {aba && abas.length > 1 && (
        <nav className="mb-4 flex gap-1 border-b border-hairline" aria-label={secao?.rotulo}>
          {abas.map((a) => {
            const ativa = a.id === aba.id;
            return (
              <Link
                key={a.id}
                href={`${a.path}${suffix}`}
                aria-current={ativa ? "page" : undefined}
                className={clsx(
                  "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                  ativa
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-muted hover:border-hairline hover:text-ink"
                )}
              >
                {a.rotulo}
              </Link>
            );
          })}
        </nav>
      )}

      <FilterBar mostrarMetrica={secao?.metrica ?? false} />

      <div className="mt-5 space-y-4">{aplicado ? children : <FiltroPendente />}</div>
    </div>
  );
}
