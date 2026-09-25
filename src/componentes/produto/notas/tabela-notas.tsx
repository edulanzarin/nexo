"use client";

import type { ReactNode } from "react";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { cn } from "@/lib/cn";
import { brl, dataBR, documento } from "@/lib/format";
import type { NotaLista } from "@/lib/types";
import { NumeroNota } from "./detalhe-nota";

function colunasNotas(tipo: "ent" | "sai", mostraEmpresa: boolean): Coluna<NotaLista>[] {
  const apagada = (n: NotaLista) => (n.cancelada ? "text-apagado" : undefined);
  return [
    {
      id: "data",
      cabecalho: "Data",
      largura: "96px",
      celula: (n) => <span className={cn("num", apagada(n))}>{dataBR(n.data)}</span>,
    },
    ...(mostraEmpresa
      ? [
          {
            id: "empresa",
            classe: "max-w-0",
            cabecalho: "Empresa",
            largura: "200px",
            celula: (n: NotaLista) => (
              <span className="block truncate" title={n.empresaNome ?? undefined}>
                {n.empresaNome ?? `Empresa ${n.empresa}`}
              </span>
            ),
          },
        ]
      : []),
    {
      id: "nota",
      cabecalho: "Nota",
      largura: "116px",
      celula: (n) => <NumeroNota numero={n.numero} serie={n.serie} />,
    },
    {
      id: "especie",
      cabecalho: "Espécie",
      largura: "170px",
      celula: (n) => (
        <span className="flex items-center gap-1.5">
          <Selo>{n.especie}</Selo>
          {n.cancelada && <Selo tom="perigo">Cancelada</Selo>}
        </span>
      ),
    },
    {
      id: "contraparte",
      classe: "max-w-0",
      cabecalho: tipo === "ent" ? "Fornecedor" : "Cliente",
      celula: (n) => (
        <span className={cn("block truncate", apagada(n))} title={n.contraparte ?? undefined}>
          {n.contraparte ?? "Sem contraparte"}
        </span>
      ),
    },
    {
      id: "documento",
      cabecalho: "Documento",
      largura: "160px",
      secundaria: true,
      celula: (n) => <span className="num text-apagado">{n.contraparteDoc ? documento(n.contraparteDoc) : ""}</span>,
    },
    {
      id: "uf",
      cabecalho: "UF",
      largura: "52px",
      secundaria: true,
      celula: (n) => <span className="text-apagado">{n.uf ?? ""}</span>,
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "140px",
      celula: (n) => (
        <span className={n.cancelada ? "text-apagado line-through" : "font-[600] text-tinta"}>{brl(n.valor)}</span>
      ),
    },
  ];
}

/**
 * A lista do explorador de notas, uma nota por linha. Sem ordenar pelo
 * cabeçalho: o servidor pagina (50 por vez, a mais recente primeiro), e
 * reordenar só a página à vista mentiria sobre o conjunto. Nota cancelada
 * continua na lista, apagada e com o valor riscado: sumir com ela esconderia
 * o cancelamento de quem está conferindo.
 */
export function TabelaNotas({
  linhas,
  tipo,
  mostraEmpresa = false,
  onLinha,
  selecionada,
  vazio,
}: {
  linhas: NotaLista[];
  tipo: "ent" | "sai";
  mostraEmpresa?: boolean;
  onLinha?: (n: NotaLista) => void;
  selecionada?: (n: NotaLista) => boolean;
  vazio?: ReactNode;
}) {
  return (
    <TabelaDados
      rotulo="Notas Fiscais"
      colunas={colunasNotas(tipo, mostraEmpresa)}
      linhas={linhas}
      chave={(n) => `${n.empresa}-${n.chave}`}
      onLinha={onLinha}
      selecionada={selecionada}
      vazio={vazio}
    />
  );
}
