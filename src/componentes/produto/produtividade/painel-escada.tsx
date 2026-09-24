"use client";

import type { ReactNode } from "react";
import { Esqueleto } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { EscadaFaixas } from "@/componentes/produto/graficos";
import type { Faixa } from "@/lib/prod-escala";

/**
 * A escada de idade num painel: atraso entre fato e registro, idade do que foi
 * apagado, tempo desde o último movimento. As abas respondem à mesma pergunta
 * ("quanto tempo isso ficou parado?"), então a escada é a mesma, do verde ao
 * crítico, e as faixas vêm do domínio (`prod-escala`), nunca da tela.
 */
export function PainelEscada({
  titulo,
  descricao,
  faixas,
  valores,
  rotuloItem,
  carregando,
  acoes,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  faixas: Faixa[];
  /** Uma contagem por faixa, na ordem da escada. */
  valores: number[] | undefined;
  rotuloItem: string;
  carregando?: boolean;
  acoes?: ReactNode;
}) {
  return (
    <Painel titulo={titulo} descricao={descricao} acoes={acoes}>
      {carregando || !valores ? (
        <div className="flex flex-col gap-3">
          <Esqueleto className="h-3 w-full rounded-full" />
          <Esqueleto className="h-14 w-full" />
        </div>
      ) : (
        <EscadaFaixas faixas={faixas} valores={valores} rotuloItem={rotuloItem} />
      )}
    </Painel>
  );
}
