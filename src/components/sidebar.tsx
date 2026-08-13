"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ChevronLeft, LogOut } from "lucide-react";
import clsx from "clsx";
import { getModulo, secoesDoModulo, type ModuloId } from "@/lib/modulos";
import { filtrosLembrados, lembrarFiltrosSecao } from "@/lib/estado-filtros-secao";
import { sair } from "@/app/login/actions";
import { ThemeToggle } from "./theme-toggle";
import { Avatar } from "./avatar";
import { Button } from "./ui";

/**
 * Sidebar escopada a um módulo: mostra só as seções dele. A escolha do módulo
 * acontece antes, no launcher — aqui o único caminho para outro módulo é
 * "Trocar módulo", que volta ao launcher. Escala para muitos módulos sem virar
 * paredão de links, porque cada módulo tem sua própria sidebar enxuta.
 */
export function ModuloSidebar({
  moduloId,
  visiveis,
  usuario,
}: {
  moduloId: ModuloId;
  /** Ids das seções que a sessão pode ver. Ausente = todas (retrocompat). */
  visiveis?: string[];
  usuario?: { id: string; nome: string; temFoto: boolean };
}) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const modulo = getModulo(moduloId);
  const permitidas = visiveis ? new Set(visiveis) : null;
  const secoes = secoesDoModulo(moduloId).filter((s) => !permitidas || permitidas.has(s.id));

  // Seção ativa (a que o caminho atual pertence): é dela que gravamos o filtro.
  const secaoAtiva = secoes.find(
    (s) => pathname === s.path || pathname.startsWith(s.path + "/")
  );
  const secaoAtivaPath = secaoAtiva?.path;
  const query = sp.toString();
  // Cada mudança de filtro/execução na seção ativa atualiza a memória DELA.
  useEffect(() => {
    if (secaoAtivaPath) lembrarFiltrosSecao(secaoAtivaPath, query);
  }, [secaoAtivaPath, query]);

  // Link de cada seção usa a memória DA PRÓPRIA seção (não a da atual): seção
  // nunca visitada nasce limpa; visitada é restaurada com o que tinha.
  const linkDaSecao = (s: (typeof secoes)[number]) => {
    const lembrado = s.path === secaoAtivaPath ? query : filtrosLembrados(s.path);
    return lembrado ? `${s.path}?${lembrado}` : s.path;
  };

  if (!modulo) return null;

  return (
    <aside className="glass-chrome sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r px-3 py-5">
      <Link
        href="/"
        className="flex items-center gap-1.5 px-2 text-xs text-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-3.5" />
        Trocar módulo
      </Link>

      <div className="mt-3 flex items-center gap-2.5 px-2">
        <Image src={modulo.icone} alt="" width={32} height={32} className="size-8" />
        <p className="text-base font-semibold tracking-tight">{modulo.titulo}</p>
      </div>

      <nav className="mt-7 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {secoes.map((s) => {
          const ativa = pathname === s.path || pathname.startsWith(s.path + "/");
          return (
            <Link
              key={s.id}
              href={linkDaSecao(s)}
              className={clsx(
                "rounded-lg px-3 py-2 text-sm transition-all duration-150 [transition-timing-function:var(--ease-spring)]",
                ativa
                  ? "bg-accent/12 font-medium text-accent ring-1 ring-inset ring-accent/15"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
            >
              {s.rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 flex flex-col gap-0.5 border-t border-hairline pt-2">
        <ThemeToggle />
        {usuario && (
          <Link
            href="/perfil"
            title="Meu perfil"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
          >
            <Avatar id={usuario.id} nome={usuario.nome} temFoto={usuario.temFoto} size={28} />
            <p className="truncate text-xs text-ink-2" title={usuario.nome}>
              {usuario.nome}
            </p>
          </Link>
        )}
        <form action={sair}>
          <Button type="submit" variant="ghost" className="w-full justify-start">
            <LogOut className="size-4 shrink-0" />
            Sair
          </Button>
        </form>
      </div>
    </aside>
  );
}
