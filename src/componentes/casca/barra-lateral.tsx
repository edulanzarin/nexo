"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCaminho } from "@/hooks/use-contexto";
import { useMemo } from "react";
import { Icone } from "@/componentes/primitivos/icone";
import { Menu } from "@/componentes/primitivos/menu";
import { cn } from "@/lib/cn";
import { lerContexto, qsSoContexto } from "@/lib/contexto";
import { MODULOS, secoesDoModulo, type Modulo, type ModuloId } from "@/lib/modulos";
import type { Secao } from "@/lib/secoes/tipos";
import { usePreferencia } from "@/hooks/use-preferencia";
import { AssinaturaNavex } from "./marca";
import { CorModulo } from "./modulo";
import { MenuUsuario, type UsuarioCasca } from "./menu-usuario";

/**
 * A barra lateral do módulo. As seções vêm agrupadas pelo trabalho (visão,
 * rotina, balancetes...) e o link de cada uma leva o contexto junto: trocar de
 * seção não perde a empresa nem o período.
 *
 * Recolhida, vira uma coluna de ícones com o nome na dica; a escolha fica
 * guardada no navegador.
 */
export function BarraLateral({
  moduloId,
  visiveis,
  modulosAcessiveis,
  usuario,
}: {
  moduloId: ModuloId;
  visiveis: string[];
  modulosAcessiveis: ModuloId[];
  usuario: UsuarioCasca;
}) {
  const pathname = useCaminho();
  const sp = useSearchParams();
  const [recolhida, setRecolhida] = usePreferencia("lateral-recolhida", false);
  const modulo = MODULOS.find((m) => m.id === moduloId)!;
  const qs = qsSoContexto(lerContexto(sp));

  const grupos = useMemo(() => {
    const vis = new Set(visiveis);
    const mapa = new Map<string, Secao[]>();
    for (const s of secoesDoModulo(moduloId)) {
      if (!vis.has(s.id)) continue;
      mapa.set(s.grupo, [...(mapa.get(s.grupo) ?? []), s]);
    }
    return [...mapa.entries()];
  }, [moduloId, visiveis]);

  const outros = MODULOS.filter((m) => m.id !== moduloId && modulosAcessiveis.includes(m.id));

  return (
    <aside
      className={cn(
        "nx-vidro nx-sem-papel sticky top-3 z-20 m-3 mr-0 flex h-[calc(100dvh-24px)] shrink-0 flex-col rounded-painel transition-[width] duration-300 ease-[var(--ease-saida)]",
        recolhida ? "w-[60px]" : "w-[236px]"
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 border-b border-linha", recolhida ? "justify-center px-0" : "px-3.5")}>
        <Link href="/" aria-label="Início" className="flex items-center rounded-controle">
          <AssinaturaNavex compacta={recolhida} />
        </Link>
        {!recolhida && (
          <button
            type="button"
            onClick={() => setRecolhida(true)}
            aria-label="Recolher barra lateral"
            title="Recolher"
            className="ml-auto grid size-7 place-items-center rounded-controle text-apagado hover:bg-poco hover:text-tinta"
          >
            <Icone nome="recolher-lateral" tamanho={15} />
          </button>
        )}
      </div>

      <div className={cn("border-b border-linha", recolhida ? "p-2" : "p-2.5")}>
        <TrocaModulo modulo={modulo} outros={outros} recolhida={recolhida} />
      </div>

      <nav aria-label={`Seções de ${modulo.titulo}`} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {grupos.map(([grupo, secoes]) => (
          <div key={grupo} className="mb-2 last:mb-0">
            {!recolhida && <p className="px-2 pt-1.5 pb-1 text-micro font-[600] text-apagado">{grupo}</p>}
            {recolhida && <div className="mx-3 my-1.5 h-px bg-linha first:hidden" />}
            <ul className="flex flex-col gap-px">
              {secoes.map((s) => {
                const ativa = pathname === s.path || pathname.startsWith(s.path + "/") ||
                  s.abas.some((a) => pathname === a.path || pathname.startsWith(a.path + "/"));
                return (
                  <li key={s.id}>
                    <Link
                      href={`${s.path}${qs ? `?${qs}` : ""}`}
                      aria-current={ativa ? "page" : undefined}
                      title={recolhida ? s.rotulo : undefined}
                      className={cn(
                        "group relative flex h-8 items-center gap-2.5 rounded-controle text-corpo transition-colors",
                        recolhida ? "justify-center" : "px-2.5",
                        ativa ? "bg-poco-forte font-[580] text-tinta" : "text-tinta-2 hover:bg-poco hover:text-tinta"
                      )}
                    >
                      {ativa && (
                        <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-acento-solido" />
                      )}
                      <Icone nome={s.icone} tamanho={16} className={ativa ? "text-tinta" : "text-apagado group-hover:text-tinta-2"} />
                      {!recolhida && <span className="truncate">{s.rotulo}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-linha", recolhida ? "flex flex-col items-center gap-1 p-2" : "p-2")}>
        {recolhida && (
          <button
            type="button"
            onClick={() => setRecolhida(false)}
            aria-label="Abrir barra lateral"
            title="Abrir"
            className="grid size-8 place-items-center rounded-controle text-apagado hover:bg-poco hover:text-tinta"
          >
            <Icone nome="abrir-lateral" tamanho={16} />
          </button>
        )}
        <MenuUsuario usuario={usuario} compacto={recolhida} />
      </div>
    </aside>
  );
}

function TrocaModulo({ modulo, outros, recolhida }: { modulo: Modulo; outros: Modulo[]; recolhida: boolean }) {
  return (
    <Menu
      lado={recolhida ? "right-start" : "bottom-start"}
      larguraMin={240}
      itens={[
        { tipo: "titulo", rotulo: "Ir para" },
        { rotulo: "Início", icone: "inicio", aoEscolher: () => (window.location.href = "/") },
        ...outros.map((m) => ({
          rotulo: m.titulo,
          icone: m.icone as never,
          detalhe: m.pronto ? undefined : "a caminho",
          desabilitado: !m.pronto,
          aoEscolher: () => (window.location.href = `/${m.id}`),
        })),
      ]}
      gatilho={(p) => (
        <button
          {...p}
          type="button"
          title={recolhida ? modulo.titulo : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-controle text-left transition-colors hover:bg-poco",
            recolhida ? "justify-center p-1" : "p-1.5"
          )}
        >
          <CorModulo modulo={modulo} />
          {!recolhida && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-medio font-[620] text-tinta">{modulo.titulo}</span>
              </span>
              <Icone nome="abre-fecha" tamanho={14} className="text-apagado" />
            </>
          )}
        </button>
      )}
    />
  );
}
