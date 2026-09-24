"use client";

import { useMemo, type ReactNode } from "react";
import { Esqueleto } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { CalendarioAtividade } from "@/componentes/produto/graficos";
import { dataBR, num } from "@/lib/format";
import type { ProdCalendario } from "@/lib/prod-tipos";
import { diasDoCalendario } from "./recorte";

/**
 * O calendário de atividade do período, do primeiro ao último dia pedido (não
 * do primeiro dia com movimento: a semana parada do começo do mês também é
 * dado). O pico vai escrito no cabeçalho, porque ninguém conta quadrados para
 * achar o dia mais cheio.
 */
export function PainelCalendario({
  calendario,
  rotuloItem,
  titulo = "Calendário",
  descricao,
  carregando,
}: {
  calendario: ProdCalendario | undefined;
  /** O que se conta, no plural e com maiúscula ("Lançamentos"). */
  rotuloItem: string;
  titulo?: ReactNode;
  descricao?: ReactNode;
  carregando?: boolean;
}) {
  const dias = useMemo(() => (calendario ? diasDoCalendario(calendario) : []), [calendario]);
  const pico = calendario?.pico;
  return (
    <Painel
      titulo={titulo}
      descricao={descricao}
      acoes={
        pico && !carregando ? (
          <span className="text-pequeno text-apagado">
            Pico em <span className="num text-tinta-2">{dataBR(pico.d)}</span> ·{" "}
            <span className="num font-[600] text-tinta-2">{num(pico.n)}</span> {rotuloItem.toLowerCase()}
          </span>
        ) : undefined
      }
    >
      {carregando || !calendario ? (
        <Esqueleto className="h-28 w-full" />
      ) : calendario.total === 0 ? (
        <p className="py-8 text-center text-corpo text-apagado italic">Nenhum dia com movimento no período.</p>
      ) : (
        <CalendarioAtividade dias={dias} rotulo={rotuloItem} />
      )}
    </Painel>
  );
}
