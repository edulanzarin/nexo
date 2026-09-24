"use client";

import type { ReactNode } from "react";
import { Esqueleto, Nota } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { RankingBarras } from "@/componentes/produto/graficos";
import { num } from "@/lib/format";

/** Um item da quebra, com a cor já resolvida pelo catálogo do dado (a classe da origem). */
export interface ItemQuebra {
  chave: string;
  nome: string;
  qtd: number;
  cor?: string;
  /** O que acompanha o número na linha ("3 pessoas", "desde mar/26"). */
  detalhe?: string;
}

/**
 * Uma quebra do período (por origem, empresa, autor, dia da semana) em barras
 * horizontais: nome de empresa é longo, e na barra vertical vira "AGROP…".
 *
 * O que a barra MEDE é de quem chama: a maioria conta lançamentos, mas o atraso
 * mede dias e o tempo mede horas, daí o `formatar`. Passado o limite, o rodapé
 * diz quantos ficaram de fora.
 */
export function PainelQuebra({
  titulo,
  descricao,
  itens,
  formatar = num,
  corPadrao = "var(--serie-1)",
  limite = 12,
  carregando,
  vazio = "Sem movimento no período.",
  aoClicar,
  selecionado,
  acoes,
  rodape,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  itens: ItemQuebra[] | undefined;
  formatar?: (v: number) => string;
  corPadrao?: string;
  limite?: number;
  carregando?: boolean;
  vazio?: ReactNode;
  /** Clique na barra (abrir o detalhe da origem, por exemplo). */
  aoClicar?: (item: ItemQuebra) => void;
  selecionado?: string | null;
  acoes?: ReactNode;
  /** Troca a nota padrão de "mostrando N de M". */
  rodape?: ReactNode;
}) {
  const sobra = itens && itens.length > limite;
  return (
    <Painel
      titulo={titulo}
      descricao={descricao}
      acoes={acoes}
      corpo="p-2"
      rodape={
        rodape ??
        (sobra ? (
          <Nota>
            Mostrando {num(limite)} de {num(itens.length)}. A lista inteira sai na exportação.
          </Nota>
        ) : undefined)
      }
    >
      {carregando || !itens ? (
        <div aria-busy className="flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-2 py-2">
              <Esqueleto className="h-3 w-44" />
              <Esqueleto className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <RankingBarras
          itens={itens}
          rotulo={(i) => i.nome}
          valor={(i) => i.qtd}
          formatar={formatar}
          detalhe={(i) => i.detalhe}
          cor={(i) => i.cor ?? corPadrao}
          aoClicar={aoClicar}
          selecionado={selecionado != null ? (i) => i.chave === selecionado : undefined}
          limite={limite}
          vazio={vazio}
        />
      )}
    </Painel>
  );
}
