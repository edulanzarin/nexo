"use client";

import { useMemo, type ReactNode } from "react";
import { Esqueleto, Nota } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { Legenda } from "@/componentes/produto/graficos";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import { DP_FAMILIAS, type DpColaborador } from "@/lib/dp-tipos";
import { CLASSES_FAMILIA, COR_FAMILIA, somaFamilia } from "./produtividade-familias";

/**
 * Quem fez quanto no período, uma barra por pessoa empilhada pelas famílias
 * de trabalho. O total sozinho esconde o perfil: quem só fecha folha e quem só
 * admite e demite podem empatar no número e ter meses opostos.
 *
 * Barra horizontal em HTML, como o `RankingBarras`: nome de pessoa é longo e,
 * no eixo de um gráfico, vira "ANA PAULA RIB…". A régua é o maior total, então
 * o comprimento compara pessoas e as fatias dentro dele comparam famílias.
 *
 * Clicar isola a pessoa no resto da tela e clicar de novo devolve o time. Quem
 * está isolado e ficou fora do topo entra no fim da lista: sem isso, a pessoa
 * escolhida no ranking sumiria justamente daqui.
 */
export function QuemFezPorFamilia({
  titulo = "Quem Fez por Família",
  descricao,
  pessoas,
  carregando,
  selecionada,
  onSelecionar,
  limite = 12,
  vazio = "Ninguém do DP lançou trabalho no período.",
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  pessoas: DpColaborador[] | undefined;
  carregando?: boolean;
  selecionada: number | null;
  onSelecionar: (codigo: number | null) => void;
  limite?: number;
  vazio?: ReactNode;
}) {
  const ordenadas = useMemo(
    () =>
      (pessoas ?? [])
        .filter((p) => p.total > 0)
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")),
    [pessoas]
  );
  const lista = useMemo(() => {
    const topo = ordenadas.slice(0, limite);
    const fora =
      selecionada != null && !topo.some((p) => p.codigo === selecionada)
        ? ordenadas.find((p) => p.codigo === selecionada)
        : undefined;
    return fora ? [...topo, fora] : topo;
  }, [ordenadas, limite, selecionada]);
  const maximo = ordenadas[0]?.total ?? 0;
  const sobra = ordenadas.length > limite;

  return (
    <Painel
      titulo={titulo}
      descricao={descricao}
      corpo="p-2"
      rodape={
        sobra ? (
          <Nota>
            Mostrando {num(limite)} de {num(ordenadas.length)}. A lista inteira sai na exportação.
          </Nota>
        ) : undefined
      }
    >
      <Legenda className="px-2 pt-1 pb-2" itens={CLASSES_FAMILIA.map((c) => ({ rotulo: c.rotulo, cor: c.cor }))} />
      {carregando || !pessoas ? (
        <div aria-busy className="flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-2 py-2">
              <Esqueleto className="h-3 w-44" />
              <Esqueleto className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p className="py-6 text-center text-corpo text-apagado italic">{vazio}</p>
      ) : (
        <ol className="flex flex-col">
          {lista.map((p) => {
            const sel = p.codigo === selecionada;
            const apagada = selecionada != null && !sel;
            const partes = DP_FAMILIAS.map((f) => ({ ...f, valor: somaFamilia(p.porTipo, f.id) })).filter(
              (f) => f.valor > 0
            );
            return (
              <li key={p.codigo}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => onSelecionar(sel ? null : p.codigo)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-controle px-2 py-1.5 text-left transition-colors hover:bg-poco",
                    sel && "bg-rota-suave"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate text-corpo", sel ? "font-[600] text-rota" : "text-tinta-2")}>
                      {p.nome}
                    </span>
                    {p.inativo && !p.auto && <Selo>Desligado</Selo>}
                  </span>
                  <span className="num text-corpo font-[600] text-tinta">{num(p.total)}</span>
                  <span className="col-span-2 flex h-1.5 w-full overflow-hidden rounded-full bg-poco-forte">
                    <span
                      role="img"
                      aria-label={`${p.nome}: ${partes.map((f) => `${f.rotulo} ${num(f.valor)}`).join(", ")}`}
                      className={cn("flex h-full", apagada && "opacity-40")}
                      style={{ width: `${maximo > 0 ? (p.total / maximo) * 100 : 0}%` }}
                    >
                      {partes.map((f) => (
                        <span
                          key={f.id}
                          title={`${f.rotulo}: ${num(f.valor)}`}
                          className="h-full"
                          style={{ width: `${(f.valor / p.total) * 100}%`, background: COR_FAMILIA[f.id] }}
                        />
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Painel>
  );
}
