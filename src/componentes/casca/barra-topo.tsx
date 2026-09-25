"use client";

import Link from "next/link";
import { useIsFetching } from "@tanstack/react-query";
import { Icone } from "@/componentes/primitivos/icone";
import { Tecla } from "@/componentes/primitivos/selo";
import { SeletorEmpresa } from "@/componentes/produto/seletor-empresa";
import { SeletorFilial } from "@/componentes/produto/seletor-filial";
import { SeletorPeriodoDia, SeletorPeriodoMes } from "@/componentes/produto/seletor-periodo";
import { cn } from "@/lib/cn";
import { periodoEfetivo, qsSoContexto } from "@/lib/contexto";
import { empresaDaAba, periodoDaAba } from "@/lib/secoes/tipos";
import { useContexto } from "@/hooks/use-contexto";
import { abrirPaleta } from "./paleta";

/**
 * O topo do módulo: onde estou (trilha), sobre o quê (o contexto de trabalho)
 * e o atalho para qualquer lugar (⌘K). O contexto só mostra o que a tela
 * atual usa: período some no cadastro, filial só aparece com uma empresa numa
 * tela que honra filial.
 */
export function BarraTopo() {
  const { contexto, mudar, local } = useContexto();
  const buscando = useIsFetching() > 0;
  const aba = local?.aba;
  const escopo = empresaDaAba(aba);
  const periodo = periodoDaAba(aba);
  const efetivo = periodoEfetivo(contexto, aba);
  const qs = qsSoContexto(contexto);
  // A aba pode ler só o período (a Rotatividade do RH escolhe a empresa dentro
  // da tela): os controles aparecem pelo que a aba usa, não só pela empresa.
  const temControles = escopo !== "nenhuma" || periodo !== "nenhum";

  return (
    <div className="nx-sem-papel sticky top-3 z-10 px-4 pt-3 sm:px-6">
      <div className="nx-vidro relative flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 rounded-painel px-3 py-2.5">
        <nav aria-label="Trilha" className="flex min-w-0 items-center gap-1.5 text-corpo">
          {local ? (
            <>
              <Link href={`/${local.modulo.id}${qs ? `?${qs}` : ""}`} className="shrink-0 text-apagado hover:text-tinta">
                {local.modulo.titulo}
              </Link>
              <Icone nome="chevron-direita" tamanho={14} className="text-apagado/60" />
              <span className="truncate font-[600] text-tinta">{local.secao.rotulo}</span>
            </>
          ) : null}
        </nav>

        {temControles && (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            {escopo !== "nenhuma" && (
              <SeletorEmpresa
                escopo={escopo}
                empresas={contexto.empresas}
                grupos={contexto.grupos}
                onMudar={(m) => mudar(m)}
              />
            )}
            {aba?.filial && contexto.empresas.length === 1 && (
              <SeletorFilial
                empresa={contexto.empresas[0]}
                estabs={contexto.estabs}
                onMudar={(estabs) => mudar({ estabs })}
              />
            )}
            {periodo === "dia" && (
              <SeletorPeriodoDia inicio={contexto.inicio} fim={contexto.fim} onMudar={(inicio, fim) => mudar({ inicio, fim })} />
            )}
            {periodo === "mes" && (
              <SeletorPeriodoMes inicio={efetivo.inicio} fim={efetivo.fim} onMudar={(inicio, fim) => mudar({ inicio, fim })} />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={abrirPaleta}
          className={cn(
            "flex h-controle items-center gap-2 rounded-controle border border-linha bg-poco px-2.5 text-corpo text-apagado transition-colors hover:border-linha-forte hover:text-tinta-2",
            !temControles && "ml-auto"
          )}
        >
          <Icone nome="buscar" tamanho={15} />
          <span className="hidden lg:inline">Ir para</span>
          <span className="hidden items-center gap-0.5 lg:flex">
            <Tecla>Ctrl</Tecla>
            <Tecla>K</Tecla>
          </span>
        </button>

        {/* Fio de progresso: qualquer consulta em voo acende o topo. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-4 bottom-0 left-4 h-[2px] overflow-hidden rounded-full transition-opacity duration-300",
            buscando ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="block h-full w-1/3 animate-[nx-corre_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-[var(--marca-laranja)] to-transparent" />
        </span>
      </div>
    </div>
  );
}
