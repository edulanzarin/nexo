"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, Layers, ScrollText, Users, type LucideIcon } from "lucide-react";
import clsx from "clsx";

/**
 * Navegação da área administrativa. Client component só para o realce da rota
 * ativa (usePathname) — o gate de admin fica no layout server. Mesmo padrão de
 * item ativo das sidebars de módulo.
 */
const ITENS: { href: string; icone: LucideIcon; rotulo: string }[] = [
  { href: "/admin/usuarios", icone: Users, rotulo: "Usuários" },
  { href: "/admin/cargos", icone: Briefcase, rotulo: "Cargos" },
  { href: "/admin/setores", icone: Building2, rotulo: "Setores" },
  { href: "/admin/grupos", icone: Layers, rotulo: "Grupos de empresa" },
  { href: "/admin/auditoria", icone: ScrollText, rotulo: "Auditoria" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-7 flex flex-1 flex-col gap-0.5">
      {ITENS.map(({ href, icone: Icone, rotulo }) => {
        const ativa = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              ativa
                ? "bg-accent/12 font-medium text-accent"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Icone className="size-4 shrink-0" />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
