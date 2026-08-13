"use client";

import { CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import type { ConformidadeEmpresa } from "@/lib/types";
import { num } from "@/lib/format";

interface Props {
  dados: ConformidadeEmpresa[] | undefined;
  carregando: boolean;
  recarregando: boolean;
}

function Celula({ valor }: { valor: number }) {
  return (
    <td className="py-2.5 pl-3 text-right tabular-nums">
      <span className={valor > 0 ? "text-critical" : "text-muted"}>{num(valor)}</span>
    </td>
  );
}

export function ConformidadeTabela({ dados, carregando, recarregando }: Props) {
  return (
    <section className="card anim-fade-up p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold">Empresas com mais pendências</h2>
      </header>

      {carregando || !dados ? (
        <div className="skeleton h-80 w-full" />
      ) : dados.length === 0 ? (
        <div className="grid h-32 place-items-center gap-2 text-center">
          <CheckCircle2 className="mx-auto size-6 text-good" />
          <p className="text-sm text-muted">Nenhuma pendência no período</p>
        </div>
      ) : (
        <div className={clsx("overflow-x-auto", recarregando && "refetching")}>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="w-8 py-2 pr-2 text-right font-medium">#</th>
                <th className="py-2 pr-3 text-left font-medium">Empresa</th>
                <th className="py-2 pl-3 text-right font-medium">NCM inválido</th>
                <th className="py-2 pl-3 text-right font-medium">Canceladas</th>
                <th className="py-2 pl-3 text-right font-medium">Denegadas</th>
                <th className="py-2 pl-3 text-right font-medium">Sem chave</th>
                <th className="py-2 pl-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((e, i) => (
                <tr
                  key={e.codigo}
                  className="border-b border-hairline/60 last:border-0 hover:bg-surface-2/50"
                >
                  <td className="py-2.5 pr-2 text-right text-xs tabular-nums text-muted">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-ink">{e.nome ?? `Empresa ${e.codigo}`}</span>
                    <span className="ml-2 text-xs text-muted">{e.codigo}</span>
                  </td>
                  <Celula valor={e.ncmInvalido} />
                  <Celula valor={e.canceladas} />
                  <Celula valor={e.denegadas} />
                  <Celula valor={e.semChave} />
                  <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-ink">
                    {num(e.pendencias)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
