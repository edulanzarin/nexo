"use client";

import { AlertTriangle, Building2, CheckCircle2, MinusCircle } from "lucide-react";
import clsx from "clsx";
import { Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useFiltros } from "@/hooks/use-filters";
import { useProvisoes } from "@/hooks/use-api";
import { brl } from "@/lib/format";
import type { StatusFechamento } from "@/lib/types";

const META: Record<StatusFechamento, { Icone: typeof CheckCircle2; cor: string; borda: string; frase: string }> = {
  ok: { Icone: CheckCircle2, cor: "text-good", borda: "border-l-good", frase: "Provisão da folha bate com o contábil." },
  atencao: { Icone: AlertTriangle, cor: "text-warning", borda: "border-l-warning", frase: "A provisão da folha diverge do que foi lançado." },
  erro: { Icone: AlertTriangle, cor: "text-critical", borda: "border-l-critical", frase: "Divergência relevante na provisão." },
  na: { Icone: MinusCircle, cor: "text-muted", borda: "border-l-hairline", frase: "Sem provisão calculada nem lançada no período." },
};

function Numero({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-ink-2">{rotulo}</p>
      <p className={clsx("text-2xl font-semibold tracking-tight tabular-nums", forte && "text-critical")}>
        {brl(valor)}
      </p>
    </div>
  );
}

export default function ProvisoesPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const res = useProvisoes(qs, temEmpresa);
  const dados = res.data;

  if (!temEmpresa) {
    return <EmptyState icon={<Building2 className="size-6" />} titulo="Selecione uma empresa" />;
  }

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível conferir as provisões"
        descricao={
          res.error instanceof Error ? res.error.message : "Tente novamente em instantes."
        }
      />
    );
  }

  if (!dados) {
    return <EmptyState titulo="Confrontando folha e contábil…" />;
  }

  const meta = META[dados.status];
  const diverge = dados.status === "atencao" || dados.status === "erro";

  return (
    <div className="space-y-4">
      {/* Confronto calculado × lançado. */}
      <Card as="section" animate="none" className={cn("border-l-4", meta.borda)}>
        <div className="flex items-start gap-3">
          <meta.Icone className={clsx("mt-0.5 size-6 shrink-0", meta.cor)} />
          <p className="text-sm font-medium text-ink">{meta.frase}</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Numero rotulo="Calculado pela folha" valor={dados.calculado} />
          <Numero rotulo="Lançado no contábil" valor={dados.lancado} />
          <Numero rotulo="Divergência" valor={dados.divergencia} forte={diverge} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Transparência do "calculado". */}
        <Card as="section" overflow padding="none" animate="none">
          <div className="border-b border-hairline px-4 py-3">
            <p className="text-sm font-medium text-ink">Folhas de provisão</p>
            <p className="text-xs text-muted">O que a folha calculou (tipo 70/71) no período.</p>
          </div>
          {dados.folhas.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted">Nenhuma folha de provisão no período.</p>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {dados.folhas.map((f) => (
                  <tr key={f.tipo} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-2">
                      <span className="text-ink">{f.descricao}</span>
                      <span className="ml-2 text-[10px] text-muted/70">
                        tipo {f.tipo}
                        {f.competencia && ` · ${f.competencia}`}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink">{brl(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        {/* Transparência do "lançado". */}
        <Card as="section" overflow padding="none" animate="none">
          <div className="border-b border-hairline px-4 py-3">
            <p className="text-sm font-medium text-ink">Contas de provisão</p>
            <p className="text-xs text-muted">Movimento credor da folha (origem FP) no contábil.</p>
          </div>
          {dados.contas.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted">Nenhum lançamento de provisão no período.</p>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {dados.contas.map((c) => (
                  <tr key={c.conta} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-2">
                      <span className="tabular-nums text-ink">{c.conta}</span>
                      <span className="ml-2 text-muted">{c.descricao}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink">{brl(c.movimento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
