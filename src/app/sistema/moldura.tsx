"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AssinaturaNavex } from "@/componentes/casca/marca";
import { definirTema, usePreferenciaTema } from "@/componentes/casca/tema";
import { Segmentado } from "@/componentes/primitivos/abas";
import { cn } from "@/lib/cn";

export const FAMILIAS = [
  { id: "fundamentos", titulo: "Fundamentos" },
  { id: "controles", titulo: "Controles" },
  { id: "sobreposicoes", titulo: "Sobreposições" },
  { id: "dados", titulo: "Dados e estados" },
  { id: "graficos", titulo: "Gráficos" },
  { id: "produto", titulo: "Produto" },
  { id: "contabil", titulo: "Contábil" },
  { id: "fiscal", titulo: "Fiscal" },
  { id: "dp", titulo: "DP" },
  { id: "rh", titulo: "RH" },
  { id: "config", titulo: "Configurações" },
];

/** A moldura do catálogo: famílias à esquerda, tema e prévia no topo. */
export function MolduraCatalogo({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tema = usePreferenciaTema();
  if (pathname.startsWith("/sistema/previa")) return <>{children}</>;
  return (
    <div className="mx-auto flex w-full max-w-[1500px] gap-8 px-4 sm:px-8">
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-6 py-8 lg:flex">
        <Link href="/" className="flex items-center">
          <AssinaturaNavex />
        </Link>
        <nav className="flex flex-col gap-px">
          <p className="mb-1 px-2 text-micro font-[600] text-apagado">Catálogo</p>
          {FAMILIAS.map((f) => (
            <a
              key={f.id}
              href={`/sistema#${f.id}`}
              className="rounded-controle px-2 py-1.5 text-corpo text-tinta-2 hover:bg-poco hover:text-tinta"
            >
              {f.titulo}
            </a>
          ))}
          <Link
            href="/sistema/previa/conferencia?empresas=1200&inicio=2026-08-01&fim=2026-08-31"
            className={cn("mt-3 rounded-controle px-2 py-1.5 text-corpo font-[560] text-acento hover:bg-acento-suave")}
          >
            Prévia de tela
          </Link>
        </nav>
      </aside>
      <div className="min-w-0 flex-1 py-8">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="nx-titulo text-[28px] leading-9 text-tinta">Catálogo de componentes</h1>
            <p className="mt-1 max-w-[70ch] text-corpo text-apagado">
              Toda peça do NaveX, viva, com o motivo de ser como é. Peça nova entra aqui no mesmo commit em que nasce.
            </p>
          </div>
          <Segmentado
            rotulo="Tema"
            opcoes={[
              { valor: "noite", rotulo: "Noite", icone: "noite" },
              { valor: "dia", rotulo: "Dia", icone: "dia" },
              { valor: "sistema", rotulo: "Windows", icone: "sistema" },
            ]}
            valor={tema}
            onMudar={definirTema}
          />
        </header>
        {children}
      </div>
    </div>
  );
}
