"use client";

import { UserRound } from "lucide-react";
import clsx from "clsx";
import { Badge } from "@/components/ui";
import { tempoCasa } from "@/components/folha-ficha-modal";
import type { FolhaMovimentacao } from "@/lib/types";
import { dataBR } from "@/lib/format";

/** Tabela de pessoas (movimentações): cada linha abre a ficha. Reusada pela
 *  seção de movimentações e pelo drill de qualquer quebra. */
export function PessoasTabela({
  dados,
  onAbrir,
  altura = "max-h-[34rem]",
  recarregando,
}: {
  dados: FolhaMovimentacao[];
  onAbrir: (m: FolhaMovimentacao) => void;
  altura?: string;
  recarregando?: boolean;
}) {
  return (
    <div
      className={clsx(
        "print-solto",
        altura,
        "overflow-y-auto overflow-x-auto",
        recarregando && "refetching"
      )}
    >
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-hairline text-xs text-muted">
            <th className="py-2 pr-3 text-left font-medium">Colaborador</th>
            <th className="py-2 px-3 text-left font-medium">Situação</th>
            <th className="py-2 px-3 text-left font-medium">Cargo · Setor</th>
            <th className="py-2 px-3 text-right font-medium">Admissão</th>
            <th className="py-2 px-3 text-right font-medium">Desligamento</th>
            <th className="py-2 pl-3 text-right font-medium">Tempo de casa</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((m) => (
            <tr
              key={`${m.codigoempresa}-${m.contrato}`}
              onClick={() => onAbrir(m)}
              className="cursor-pointer border-b border-hairline/60 last:border-0 hover:bg-surface-2/50"
            >
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                    <UserRound className="size-3.5" />
                  </span>
                  <span className="font-medium text-ink">{m.nome}</span>
                </div>
              </td>
              <td className="py-2.5 px-3">
                <div className="flex flex-wrap gap-1">
                  {m.admitido && (
                    <Badge tone="good" size="xs" uppercase>
                      admitido
                    </Badge>
                  )}
                  {m.desligado && (
                    <Badge tone="critical" size="xs" uppercase>
                      desligado
                    </Badge>
                  )}
                </div>
                {m.desligado && m.motivo && (
                  <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-muted" title={m.motivo}>
                    {m.motivo}
                  </p>
                )}
              </td>
              <td className="py-2.5 px-3">
                <p className="text-ink-2">{m.cargo}</p>
                <p className="text-[11px] text-muted">{m.setor}</p>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-ink-2">{dataBR(m.dataadm)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-ink-2">
                {m.datadem ? dataBR(m.datadem) : "—"}
              </td>
              <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">
                {tempoCasa(m.tempoCasaDias)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
