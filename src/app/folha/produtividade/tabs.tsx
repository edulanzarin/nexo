"use client";

import { createContext, useContext, useState } from "react";
import clsx from "clsx";
import { DP_FAMILIAS, type DpFamilia } from "@/lib/dp-tipos";

/**
 * Aba ativa da Produtividade: visão geral + uma por FAMÍLIA de trabalho.
 *
 * Era uma aba por trabalho, e funcionava com quatro. Com doze viraria uma
 * lista de treze botões na horizontal — navegação que não cabe na tela nem na
 * cabeça. A aba passou a ser a família (cinco), e o trabalho dentro dela vira
 * um seletor: mesma profundidade, um nível de agrupamento a mais.
 */
export type MenuProd = "geral" | DpFamilia;

const ABAS: { id: MenuProd; rotulo: string; titulo?: string }[] = [
  { id: "geral", rotulo: "Visão geral" },
  ...DP_FAMILIAS.map((f) => ({ id: f.id as MenuProd, rotulo: f.rotulo, titulo: f.descricao })),
];

interface Ctx {
  menu: MenuProd;
  setMenu: (m: MenuProd) => void;
}

const TabsCtx = createContext<Ctx | null>(null);

/**
 * Estado da aba vive no shell (não na URL) porque `useFiltros.atualizar`
 * reconstrói a query inteira ao Executar — um param de aba seria apagado. O
 * shell desenha o menu (acima da barra de filtros, como na Conciliação) e a
 * página lê a aba daqui.
 */
export function ProdutividadeTabsProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuProd>("geral");
  return <TabsCtx.Provider value={{ menu, setMenu }}>{children}</TabsCtx.Provider>;
}

export function useProdutividadeTabs() {
  const c = useContext(TabsCtx);
  if (!c) throw new Error("useProdutividadeTabs precisa do ProdutividadeTabsProvider");
  return c;
}

/** Menu do topo, no mesmo estilo das abas do módulo (Conciliação). */
export function ProdutividadeMenus() {
  const { menu, setMenu } = useProdutividadeTabs();
  return (
    <nav className="mb-4 flex gap-1 border-b border-hairline" aria-label="Produtividade">
      {ABAS.map((a) => {
        const ativa = a.id === menu;
        return (
          <button
            key={a.id}
            onClick={() => setMenu(a.id)}
            title={a.titulo}
            aria-current={ativa ? "page" : undefined}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              ativa
                ? "border-accent font-medium text-accent"
                : "border-transparent text-muted hover:border-hairline hover:text-ink"
            )}
          >
            {a.rotulo}
          </button>
        );
      })}
    </nav>
  );
}
