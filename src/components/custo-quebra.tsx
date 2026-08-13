"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui";
import type { CustoGrupo } from "@/lib/types";
import { brl, num } from "@/lib/format";

/**
 * Quebra do custo de folha por uma dimensão (setor, cargo, estabelecimento). O
 * custo (proventos) ganha uma barra proporcional ao maior grupo — a leitura de
 * "onde o dinheiro está" bate o olho. Rola dentro de si, thead sticky.
 */
export function CustoQuebra({
  titulo,
  subtitulo,
  rotuloColuna,
  dados,
}: {
  titulo: string;
  subtitulo: string;
  rotuloColuna: string;
  dados: CustoGrupo[];
}) {
  const [busca, setBusca] = useState("");
  const max = useMemo(() => Math.max(1, ...dados.map((d) => d.proventos)), [dados]);
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? dados.filter((d) => d.grupo.toLowerCase().includes(q)) : dados;
  }, [dados, busca]);

  return (
    <Card as="section">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>}
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5">
          <Search className="size-3.5 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar ${rotuloColuna.toLowerCase()}…`}
            className="w-32 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
          />
        </label>
      </header>

      <div className="max-h-[26rem] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-hairline text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">{rotuloColuna}</th>
              <th className="py-2 pl-3 text-right font-medium">Custo</th>
              <th className="py-2 pl-3 text-right font-medium">Pessoas</th>
              <th className="py-2 pl-3 text-right font-medium">Médio</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-muted">
                  Nenhum grupo
                </td>
              </tr>
            ) : (
              visiveis.map((d) => (
                <tr key={d.grupo} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="truncate font-medium text-ink" title={d.grupo}>
                      {d.grupo}
                    </div>
                    <div className="mt-1 h-1 rounded bg-ent/15">
                      <div
                        className="h-1 rounded bg-ent"
                        style={{ width: `${(d.proventos / max) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2 pl-3 text-right align-top tabular-nums text-ink">{brl(d.proventos)}</td>
                  <td className="py-2 pl-3 text-right align-top tabular-nums text-ink-2">{num(d.funcionarios)}</td>
                  <td className="py-2 pl-3 text-right align-top tabular-nums text-muted">{brl(d.custoMedio)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
