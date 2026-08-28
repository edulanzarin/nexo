"use client";

import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import clsx from "clsx";
import { Badge, Card, Table, Td, Th, Thead, Tr } from "@/components/ui";
import type { FisPessoa } from "@/lib/fiscal-produtividade-tipos";
import { brlCompact, dataBR, num } from "@/lib/format";

type Coluna =
  | "notas"
  | "entradas"
  | "saidas"
  | "aDedo"
  | "canceladas"
  | "rodadas"
  | "empresas"
  | "valor";

const COLUNAS: { key: Coluna; rotulo: string; titulo?: string }[] = [
  { key: "notas", rotulo: "Notas" },
  { key: "entradas", rotulo: "Entradas", titulo: "Notas de entrada (lctofisent)" },
  { key: "saidas", rotulo: "Saídas", titulo: "Notas de saída (lctofissai)" },
  { key: "aDedo", rotulo: "A dedo", titulo: "Digitadas ou importadas — o que não veio da integração" },
  { key: "canceladas", rotulo: "Canceladas", titulo: "Trabalho feito antes de a nota ser cancelada" },
  { key: "rodadas", rotulo: "Rodadas", titulo: "Empresa × dia × espécie — quantas vezes sentou e rodou" },
  { key: "empresas", rotulo: "Empresas" },
  { key: "valor", rotulo: "Valor" },
];

/**
 * Ranking do time do Fiscal. Cada linha é uma pessoa; a barra de fundo é a
 * participação dela no total da coluna ordenada. Clicar isola a pessoa no resto
 * da tela — o ranking segue inteiro, porque ele É a comparação.
 *
 * "A dedo" e "Canceladas" ficam ao lado do total de propósito: numa base em que
 * ~98% das notas entram por integração, o volume bruto diz pouco e essas duas
 * colunas são onde o trabalho humano aparece.
 */
export function FisProdTabela({
  dados,
  carregando,
  recarregando,
  selecionado,
  onSelecionar,
}: {
  dados: FisPessoa[] | undefined;
  carregando: boolean;
  recarregando: boolean;
  selecionado: number | null;
  onSelecionar: (codigo: number | null) => void;
}) {
  const [ordenar, setOrdenar] = useState<Coluna>("notas");

  const ordenados = useMemo(
    () => (dados ? [...dados].sort((a, b) => b[ordenar] - a[ordenar]) : undefined),
    [dados, ordenar]
  );
  const max = ordenados?.length ? Math.max(...ordenados.map((p) => p[ordenar])) : 0;
  const total = ordenados?.reduce((a, p) => a + p.notas, 0) ?? 0;

  return (
    <Card as="section">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Quem escriturou</h2>
          <p className="mt-0.5 text-xs text-muted">
            Clique numa pessoa para isolar o restante da tela · ordene por qualquer coluna
          </p>
        </div>
        {total > 0 && <p className="tnum text-xs text-muted">{num(total)} notas no período</p>}
      </header>

      {carregando || !ordenados ? (
        <div className="skeleton h-96 w-full" />
      ) : ordenados.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">
          Ninguém lançou nota no período
        </p>
      ) : (
        <div className="max-h-[34rem] overflow-y-auto">
          <Table minWidth="min-w-[860px]" recarregando={recarregando}>
            <Thead sticky>
              <Th className="w-8 pr-2 text-right">#</Th>
              <Th>Pessoa</Th>
              {COLUNAS.map((c) => {
                const ativo = ordenar === c.key;
                return (
                  <Th key={c.key} numeric title={c.titulo}>
                    <button
                      onClick={() => setOrdenar(c.key)}
                      className={clsx(
                        "inline-flex items-center gap-1 transition-colors hover:text-ink",
                        ativo && "text-ink"
                      )}
                    >
                      {c.rotulo}
                      {ativo && <ArrowDown className="size-3" />}
                    </button>
                  </Th>
                );
              })}
            </Thead>
            <tbody>
              {ordenados.map((p, i) => {
                const ativa = selecionado === p.codigo;
                const pct = max > 0 ? (p[ordenar] / max) * 100 : 0;
                return (
                  <Tr
                    key={p.codigo}
                    clickable
                    onClick={() => onSelecionar(ativa ? null : p.codigo)}
                    className={clsx(ativa && "bg-accent/8")}
                  >
                    <Td numeric className="pr-2 text-xs text-muted">
                      {i + 1}
                    </Td>
                    <Td>
                      <div className="relative">
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 -z-10 rounded-sm bg-accent/10"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="flex items-center gap-2">
                          <span className={clsx("truncate", ativa && "font-medium text-accent")}>
                            {p.nome}
                          </span>
                          {p.inativo && <Badge tone="neutral">desligado</Badge>}
                        </span>
                      </div>
                    </Td>
                    {COLUNAS.map((c) => {
                      const v = p[c.key];
                      return (
                        <Td key={c.key} numeric className={clsx(v === 0 && "text-muted")}>
                          {c.key === "valor" ? brlCompact(v) : num(v)}
                        </Td>
                      );
                    })}
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {ordenados && ordenados.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Última nota de cada pessoa:{" "}
          {ordenados
            .slice(0, 3)
            .map((p) => `${p.nome.split(" ")[0]} ${dataBR(p.ultimo)}`)
            .join(" · ")}
        </p>
      )}
    </Card>
  );
}
