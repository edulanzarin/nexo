"use client";

import { useMemo, useState } from "react";
import { ArrowDown, Search } from "lucide-react";
import clsx from "clsx";
import { Card } from "@/components/ui";
import type { TurnoverGrupo } from "@/lib/types";
import { num } from "@/lib/format";

type Coluna = "ativos" | "admissoes" | "desligamentos" | "turnover";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Faixa de turnover → cor do badge. Zero (sem movimento) fica neutro. */
function corBadge(t: number): string {
  if (t > 10) return "bg-critical/12 text-critical";
  if (t >= 2) return "bg-warning/15 text-warning";
  if (t > 0) return "bg-good/12 text-good";
  return "text-muted";
}

interface Props {
  titulo: string;
  subtitulo: string;
  /** Rótulo da 1ª coluna, ex.: "Organograma", "Cargo". */
  rotuloColuna: string;
  dados: TurnoverGrupo[] | undefined;
  /** Linha de total (bate com os KPIs) — o consolidado da empresa. */
  total: { ativos: number; admissoes: number; desligamentos: number; turnover: number } | undefined;
  carregando: boolean;
  recarregando: boolean;
  /** Dimensão do drill (setor, cargo, estab, sexo, faixaEtaria). Com ela e
   *  `onDrill`, cada linha vira clicável e abre as pessoas do grupo. */
  dim?: string;
  onDrill?: (dim: string, valor: string, rotulo: string) => void;
  /** Quebra pequena (poucos grupos): esconde a barra de filtro/busca. */
  compacto?: boolean;
}

export function RotatividadeQuebra({
  titulo,
  subtitulo,
  rotuloColuna,
  dados,
  total,
  carregando,
  recarregando,
  dim,
  onDrill,
  compacto = false,
}: Props) {
  const clicavel = !!(dim && onDrill);
  const [ordenar, setOrdenar] = useState<Coluna>("ativos");
  const [soMovimento, setSoMovimento] = useState(false);
  const [busca, setBusca] = useState("");

  const CABECALHOS: { key: Coluna; rotulo: string }[] = [
    { key: "ativos", rotulo: "Colab. ativos" },
    { key: "admissoes", rotulo: "Admissões" },
    { key: "desligamentos", rotulo: "Desligamentos" },
    { key: "turnover", rotulo: "Turnover" },
  ];

  const visiveis = useMemo(() => {
    if (!dados) return undefined;
    const q = busca.trim().toLowerCase();
    return [...dados]
      .filter((o) => {
        if (q && !o.grupo.toLowerCase().includes(q)) return false;
        if (soMovimento && o.admissoes + o.desligamentos === 0) return false;
        return true;
      })
      .sort((a, b) => b[ordenar] - a[ordenar] || a.grupo.localeCompare(b.grupo));
  }, [dados, busca, soMovimento, ordenar]);

  return (
    <Card as="section">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>}
        </div>
        {visiveis && (
          <span className="text-xs text-muted">
            {num(visiveis.length)} {visiveis.length === 1 ? "grupo" : "grupos"}
          </span>
        )}
      </header>

      {/* Só um toggle útil (esconde setores parados) + busca — some no compacto */}
      {!compacto && (
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSoMovimento((v) => !v)}
          className={clsx(
            "rounded-lg border px-3 py-1.5 text-xs transition-colors",
            soMovimento
              ? "border-ent/30 bg-accent/12 font-medium text-accent"
              : "border-hairline bg-surface-2 text-muted hover:text-ink"
          )}
        >
          Só com movimentação
        </button>
        <label className="ml-auto flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5">
          <Search className="size-3.5 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar ${rotuloColuna.toLowerCase()}…`}
            className="w-40 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
          />
        </label>
      </div>
      )}

      {carregando || !visiveis ? (
        <div className="skeleton h-96 w-full" />
      ) : (
        <div
          className={clsx(
            "print-solto max-h-[34rem] overflow-y-auto overflow-x-auto",
            recarregando && "refetching"
          )}
        >
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pr-3 text-left font-medium">{rotuloColuna}</th>
                {CABECALHOS.map((h) => {
                  const ativo = ordenar === h.key;
                  return (
                    <th key={h.key} className="py-2 pl-3 text-right font-medium">
                      <button
                        onClick={() => setOrdenar(h.key)}
                        className={clsx(
                          "inline-flex items-center gap-1 transition-colors hover:text-ink",
                          ativo && "text-ink"
                        )}
                      >
                        {h.rotulo}
                        <ArrowDown className={clsx("size-3", !ativo && "opacity-0")} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted">
                    Nenhum grupo nesta faixa
                  </td>
                </tr>
              ) : (
                visiveis.map((o) => {
                  return (
                    <tr
                      key={o.grupo}
                      onClick={
                        clicavel ? () => onDrill!(dim!, o.grupo, `${rotuloColuna}: ${o.grupo}`) : undefined
                      }
                      className={clsx(
                        "border-b border-hairline/60 last:border-0 hover:bg-surface-2/50",
                        clicavel && "cursor-pointer"
                      )}
                    >
                      <td className="py-2.5 pr-3 font-medium text-ink">{o.grupo}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{num(o.ativos)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">
                        <span className={o.admissoes > 0 ? "text-good" : "text-muted"}>
                          {num(o.admissoes)}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">
                        <span className={o.desligamentos > 0 ? "text-critical" : "text-muted"}>
                          {num(o.desligamentos)}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <span
                          className={clsx(
                            "inline-block rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
                            corBadge(o.turnover)
                          )}
                        >
                          {pct(o.turnover)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {total && !soMovimento && !busca && (
              <tfoot className="sticky bottom-0 bg-surface">
                <tr className="border-t border-hairline text-sm font-semibold">
                  <td className="py-2.5 pr-3">Total da empresa</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{num(total.ativos)}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-good">{num(total.admissoes)}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-critical">
                    {num(total.desligamentos)}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{pct(total.turnover)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}
