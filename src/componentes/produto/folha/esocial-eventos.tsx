"use client";

import { useMemo } from "react";
import { BarraComposicao } from "@/componentes/primitivos/barra";
import { Vazio } from "@/componentes/primitivos/estados";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { Legenda } from "@/componentes/produto/graficos";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import type { EventoEsocial } from "@/lib/types";

/*
 * Os eventos do eSocial por tipo, com o resultado de cada um numa barra de
 * composição. A cor é o juízo (aceito, pendente, rejeitado), a mesma dos selos
 * de situação, e a palavra vai na legenda e no cabeçalho de cada número.
 */

export const PARTES_ESOCIAL = [
  { chave: "aceitos", rotulo: "Aceitos", cor: "var(--ok)" },
  { chave: "pendentes", rotulo: "Pendentes", cor: "var(--atencao)" },
  { chave: "rejeitados", rotulo: "Rejeitados", cor: "var(--perigo)" },
] as const;

export function LegendaEsocial() {
  return <Legenda itens={PARTES_ESOCIAL.map((p) => ({ rotulo: p.rotulo, cor: p.cor }))} />;
}

/** Contagem que acende no tom quando existe; zero fica apagado para o olho achar o que pede ação. */
function Contagem({ valor, classe }: { valor: number; classe: string }) {
  return <span className={cn(valor > 0 ? classe : "text-apagado")}>{num(valor)}</span>;
}

export function TabelaEventosEsocial({ eventos }: { eventos: EventoEsocial[] }) {
  const colunas = useMemo<Coluna<EventoEsocial>[]>(() => {
    const soma = (k: "aceitos" | "pendentes" | "rejeitados" | "total") => eventos.reduce((s, e) => s + e[k], 0);
    return [
      {
        id: "evento",
        cabecalho: "Evento",
        largura: "40%",
        ordenar: (e) => e.evento,
        celula: (e) => (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="num shrink-0 text-pequeno text-apagado">{e.evento}</span>
            <span className="truncate text-tinta" title={e.descricao}>
              {e.descricao}
            </span>
          </span>
        ),
        rodape: `${num(eventos.length)} ${eventos.length === 1 ? "tipo" : "tipos"}`,
      },
      {
        id: "resultado",
        cabecalho: "Resultado",
        largura: "22%",
        secundaria: true,
        celula: (e) => (
          <BarraComposicao
            partes={PARTES_ESOCIAL.map((p) => ({ valor: e[p.chave], cor: p.cor, rotulo: `${p.rotulo}: ${num(e[p.chave])}` }))}
          />
        ),
      },
      {
        id: "aceitos",
        cabecalho: "Aceitos",
        alinhar: "dir",
        ordenar: (e) => e.aceitos,
        celula: (e) => <Contagem valor={e.aceitos} classe="text-tinta" />,
        rodape: num(soma("aceitos")),
      },
      {
        id: "pendentes",
        cabecalho: "Pendentes",
        alinhar: "dir",
        ordenar: (e) => e.pendentes,
        celula: (e) => <Contagem valor={e.pendentes} classe="font-[600] text-atencao" />,
        rodape: num(soma("pendentes")),
      },
      {
        id: "rejeitados",
        cabecalho: "Rejeitados",
        alinhar: "dir",
        ordenar: (e) => e.rejeitados,
        celula: (e) => <Contagem valor={e.rejeitados} classe="font-[600] text-perigo" />,
        rodape: num(soma("rejeitados")),
      },
      {
        id: "total",
        cabecalho: "Total",
        alinhar: "dir",
        ordenar: (e) => e.total,
        classe: "font-[600] text-tinta",
        celula: (e) => num(e.total),
        rodape: num(soma("total")),
      },
    ];
  }, [eventos]);

  return (
    <TabelaDados
      rotulo="Eventos do eSocial por tipo"
      colunas={colunas}
      linhas={eventos}
      chave={(e) => e.evento}
      alturaMax="32rem"
      vazio={<Vazio compacto icone="enviar" titulo="Nenhum evento transmitido no período" />}
    />
  );
}
