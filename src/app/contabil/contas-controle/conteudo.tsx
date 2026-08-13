"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Layers, PencilLine, Wallet } from "lucide-react";
import clsx from "clsx";
import { Kpi } from "@/components/kpi-conf";
import { useFiltros } from "@/hooks/use-filters";
import { useContasControle } from "@/hooks/use-api";
import { brl } from "@/lib/format";
import type { OrigemBucket } from "@/lib/types";

/** Ordem e rótulo das colunas de origem. Manual por último: é o balde-alerta. */
const ORIGENS: { chave: OrigemBucket; rotulo: string }[] = [
  { chave: "fiscal", rotulo: "Fiscal" },
  { chave: "folha", rotulo: "Folha" },
  { chave: "financeiro", rotulo: "Financeiro" },
  { chave: "patrimonio", rotulo: "Patrimônio" },
  { chave: "outros", rotulo: "Outros" },
  { chave: "manual", rotulo: "Manual" },
];

/** Saldo com natureza D/C, como o Questor imprime (magnitude + letra). */
function SaldoCel({ v }: { v: number }) {
  if (Math.abs(v) < 0.005) return <span className="text-muted/40">—</span>;
  return (
    <span className="tabular-nums">
      {brl(Math.abs(v))} <span className="text-[10px] text-muted">{v >= 0 ? "D" : "C"}</span>
    </span>
  );
}

/** Movimento líquido de uma origem (na direção natural): sinal explícito. */
function MovCel({ v, alerta }: { v: number; alerta?: boolean }) {
  if (Math.abs(v) < 0.005) return <span className="text-muted/30">—</span>;
  return (
    <span className={clsx("tabular-nums", alerta ? "font-medium text-warning" : "text-ink")}>
      {v < 0 ? "−" : ""}
      {brl(Math.abs(v))}
    </span>
  );
}

export default function ContasControlePage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const res = useContasControle(qs, temEmpresa);
  const dados = res.data;
  const [soManual, setSoManual] = useState(false);

  // Só mostra colunas de origem que aparecem em alguma conta — menos ruído.
  const colunas = useMemo(() => {
    if (!dados) return [];
    return ORIGENS.filter((o) => dados.contas.some((c) => Math.abs(c.origens[o.chave]) >= 0.005));
  }, [dados]);

  const linhas = useMemo(() => {
    if (!dados) return [];
    return soManual ? dados.contas.filter((c) => c.temManual) : dados.contas;
  }, [dados, soManual]);

  if (!temEmpresa) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Building2 className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Selecione uma empresa</p>
        <p className="max-w-md text-xs text-muted">
          A conciliação abre o movimento das contas de controle de uma empresa por vez.
        </p>
      </section>
    );
  }

  if (res.isError) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-critical/12 text-critical">
          <AlertTriangle className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Não foi possível montar a conciliação</p>
        <p className="max-w-md text-xs text-muted">
          {res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
        </p>
      </section>
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Abrindo o movimento por origem…</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Contas de controle"
          icone={<Layers className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={String(dados.resumo.totalContas)}
          secundario="Patrimoniais com movimento no mês"
        />
        <Kpi
          rotulo="Com ajuste manual"
          icone={<PencilLine className="size-4" />}
          corIcone="bg-warning/12 text-warning"
          valor={String(dados.resumo.contasComManual)}
          secundario="Lançamento a dedo numa conta de módulo"
          alerta={dados.resumo.contasComManual > 0}
        />
        <Kpi
          rotulo="Valor manual"
          icone={<Wallet className="size-4" />}
          corIcone="bg-warning/12 text-warning"
          valor={brl(dados.resumo.valorManual)}
          secundario="Soma dos ajustes manuais do mês"
        />
      </div>

      {dados.contas.length === 0 ? (
        <section className="card grid place-items-center px-6 py-14 text-center">
          <p className="text-sm text-muted">Sem movimento em contas patrimoniais no período.</p>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <p className="text-xs text-muted">
              Movimento do mês na direção natural da conta (+ aumenta o saldo). Manual acende o alerta.
            </p>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={soManual}
                onChange={(e) => setSoManual(e.target.checked)}
                className="size-3.5 accent-[var(--ent)]"
              />
              Só com ajuste manual
            </label>
          </div>

          <div className="max-h-[34rem] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Conta</th>
                  <th className="px-2 py-2 text-right font-medium">Saldo final</th>
                  {colunas.map((c) => (
                    <th key={c.chave} className="px-2 py-2 text-right font-medium">
                      {c.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((c) => (
                  <tr key={c.conta} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-ink">{c.conta}</span>
                        <span className="truncate text-muted">{c.descricao}</span>
                        {c.temManual && (
                          <span className="shrink-0 rounded bg-warning/12 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                            manual
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted/70">{c.classif}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <SaldoCel v={c.saldoFinal} />
                    </td>
                    {colunas.map((col) => (
                      <td key={col.chave} className="px-2 py-2 text-right">
                        <MovCel v={c.origens[col.chave]} alerta={col.chave === "manual"} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
