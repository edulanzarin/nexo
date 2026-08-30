"use client";

import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import clsx from "clsx";
import { Badge, Card, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { num } from "@/lib/format";

/**
 * Uma coluna do ranking. `valor` serve para ORDENAR e para a barra de fundo;
 * `render` é só a aparência. Separar os dois deixa uma coluna de texto ("mais
 * velha: mai/2026") ordenar por número sem virar comparação de string.
 */
export interface ColunaRanking<T> {
  key: string;
  rotulo: string;
  titulo?: string;
  valor: (linha: T) => number;
  render?: (linha: T) => React.ReactNode;
  /** Pinta a célula de crítico (número que pede atenção). */
  alerta?: (linha: T) => boolean;
}

/**
 * Chave de quem está sendo comparado. É `number` em toda aba que lê o Questor
 * (`codigousuario` é inteiro) e `string` na aba No Nexo, cujo autor é o
 * `usuario.id` uuid do app. O componente é genérico na chave em vez de o payload
 * do app inventar um número só para caber aqui — ver [[Componente que serve dois
 * donos recebe o catálogo, não o campo renomeado]].
 */
export type ChaveRanking = string | number;

export interface LinhaRanking<K extends ChaveRanking = number> {
  codigo: K;
  nome: string;
  inativo: boolean;
}

/**
 * Ranking de pessoas do Contábil — a mesma moldura das quatro abas que comparam
 * gente (Lançamentos tem a sua, mais antiga e com a quebra por natureza).
 *
 * A barra de fundo mede a coluna ORDENADA, não a primeira: ordenar por "mediana
 * de atraso" e ver a barra do volume seria um gráfico contando outra história.
 * Clicar numa linha isola a pessoa no resto da tela; o ranking segue inteiro,
 * porque ele É a comparação.
 */
export function CtbRankingTabela<K extends ChaveRanking, T extends LinhaRanking<K>>({
  titulo,
  subtitulo,
  dados,
  colunas,
  ordemInicial,
  carregando,
  recarregando,
  selecionado,
  onSelecionar,
  minWidth = "min-w-[760px]",
  vazio = "Ninguém no período",
  rodape,
}: {
  titulo: string;
  subtitulo: string;
  dados: T[] | undefined;
  colunas: ColunaRanking<T>[];
  ordemInicial: string;
  carregando: boolean;
  recarregando: boolean;
  selecionado: K | null;
  onSelecionar: (codigo: K | null) => void;
  minWidth?: string;
  vazio?: string;
  rodape?: React.ReactNode;
}) {
  const [ordenar, setOrdenar] = useState(ordemInicial);
  const coluna = colunas.find((c) => c.key === ordenar) ?? colunas[0];

  const ordenados = useMemo(
    () => (dados ? [...dados].sort((a, b) => coluna.valor(b) - coluna.valor(a)) : undefined),
    [dados, coluna]
  );
  const max = ordenados?.length ? Math.max(...ordenados.map((l) => coluna.valor(l))) : 0;

  return (
    <Card as="section">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>
        </div>
        {ordenados && ordenados.length > 0 && (
          <p className="tnum text-xs text-muted">{num(ordenados.length)} pessoas</p>
        )}
      </header>

      {carregando || !ordenados ? (
        <div className="skeleton h-96 w-full" />
      ) : ordenados.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">{vazio}</p>
      ) : (
        <div className="max-h-[34rem] overflow-y-auto">
          <Table minWidth={minWidth} recarregando={recarregando}>
            <Thead sticky>
              <Th className="w-8 pr-2 text-right">#</Th>
              <Th>Pessoa</Th>
              {colunas.map((c) => {
                const ativo = c.key === ordenar;
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
              {ordenados.map((linha, i) => {
                const ativa = selecionado === linha.codigo;
                const pct = max > 0 ? (coluna.valor(linha) / max) * 100 : 0;
                return (
                  <Tr
                    key={linha.codigo}
                    clickable
                    onClick={() => onSelecionar(ativa ? null : linha.codigo)}
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
                            {linha.nome}
                          </span>
                          {linha.inativo && <Badge tone="neutral">desligado</Badge>}
                        </span>
                      </div>
                    </Td>
                    {colunas.map((c) => (
                      <Td
                        key={c.key}
                        numeric
                        className={clsx(
                          c.alerta?.(linha) && "text-critical",
                          !c.alerta?.(linha) && c.valor(linha) === 0 && "text-muted"
                        )}
                      >
                        {c.render ? c.render(linha) : num(c.valor(linha))}
                      </Td>
                    ))}
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {rodape && <div className="mt-3 text-xs text-muted">{rodape}</div>}
    </Card>
  );
}
