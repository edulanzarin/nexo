"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Landmark, Search } from "lucide-react";
import clsx from "clsx";
import { RegraExtratoLinha } from "@/components/regra-extrato-linha";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import { num } from "@/lib/format";
import type { ContaBanco } from "@/lib/types";

async function carregarTodas(empresa: number) {
  const res = await fetch(`/api/contabil/extrato-regras?empresa=${empresa}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return (await res.json()) as ContaBanco[];
}

async function carregarConta(empresa: number, conta: number) {
  const res = await fetch(`/api/contabil/extrato-regras?empresa=${empresa}&conta=${conta}`);
  const corpo = await res.json();
  if (!res.ok) throw new Error(corpo?.error ?? "Falha ao carregar");
  return corpo as ContaBanco;
}

/**
 * Lista e cadastro das regras da conta escolhida. A conta se escolhe na linha
 * da barra de filtros (controles do shell); barra e página compartilham o
 * estado da seção, então a troca reflete aqui na hora.
 */
export default function RegrasPage() {
  const { filtros } = useFiltros();
  const queryClient = useQueryClient();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  const [conta, setConta] = useEstadoSecao<number | null>("conta", null);
  const [busca, setBusca] = useEstadoSecao("busca", "");

  // Contas que já têm cadastro: atalho para navegar entre elas.
  const { data: comRegras } = useQuery({
    queryKey: ["extrato-regras", empresa],
    queryFn: () => carregarTodas(empresa),
    enabled: temEmpresa,
  });

  const { data: atual, isLoading } = useQuery({
    queryKey: ["extrato-regras", empresa, conta],
    queryFn: () => carregarConta(empresa, conta!),
    enabled: temEmpresa && conta != null,
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: ["extrato-regras"] });

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!atual) return [];
    if (!q) return atual.regras;
    return atual.regras.filter(
      (r) =>
        r.termoOriginal.toLowerCase().includes(q) ||
        String(r.contaPagamento ?? "").includes(q) ||
        String(r.contaRecebimento ?? "").includes(q) ||
        (r.descrPagamento ?? "").toLowerCase().includes(q) ||
        (r.descrRecebimento ?? "").toLowerCase().includes(q)
    );
  }, [atual, busca]);

  if (!temEmpresa) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Building2 className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Selecione uma empresa</p>
      </section>
    );
  }

  return (
    <>
      {!!comRegras?.length && (
        <div className="anim-fade-up flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted">Já cadastradas:</span>
          {comRegras.map((c) => (
            <button
              key={c.conta}
              onClick={() => setConta(c.conta)}
              className={clsx(
                "rounded-lg px-2 py-1 text-xs transition-colors",
                c.conta === conta
                  ? "bg-accent/12 font-medium text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              )}
            >
              {c.conta} · {c.descricao}
              <span className="ml-1 text-[10px]">({c.regras.length})</span>
            </button>
          ))}
        </div>
      )}

      {conta == null ? (
        <section className="card grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Landmark className="size-6" />
          </span>
          <p className="text-sm font-medium text-ink">Escolha uma conta de banco</p>
        </section>
      ) : isLoading || !atual ? (
        <div className="skeleton h-64 w-full" />
      ) : (
        <section className="card anim-fade-up p-5">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-ent/12 text-ent">
                <Landmark className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">
                  {atual.descricao ?? `Conta ${atual.conta}`}
                </h2>
                <p className="text-xs text-muted">
                  conta {atual.conta} · {num(atual.regras.length)}{" "}
                  {atual.regras.length === 1 ? "regra" : "regras"}
                  {busca && ` · ${num(visiveis.length)} no filtro`}
                </p>
              </div>
            </div>
            {atual.regras.length > 8 && (
              <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5">
                <Search className="size-4 text-muted" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar por termo ou conta…"
                  className="w-48 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
                />
              </div>
            )}
          </header>

          {/* Altura limitada: o cadastro cresce sem fim e a página não pode
              crescer junto. Cabeçalho fica fixo e a linha de nova regra vem
              antes da lista, para continuar alcançável com a lista rolada. */}
          <div className="max-h-[30rem] overflow-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-hairline text-xs text-muted">
                  <th className="w-64 py-2 pr-3 text-left font-medium">Descrição no extrato</th>
                  <th className="w-28 py-2 pr-3 text-left font-medium">Casamento</th>
                  <th className="py-2 pr-3 text-left font-medium">Se for pagamento</th>
                  <th className="py-2 pr-3 text-left font-medium">Se for recebimento</th>
                  <th className="w-20 py-2 pl-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                <RegraExtratoLinha
                  empresa={empresa}
                  conta={atual.conta}
                  regra={null}
                  onSalvo={recarregar}
                />
                {visiveis.map((r) => (
                  <RegraExtratoLinha
                    key={r.id}
                    empresa={empresa}
                    conta={atual.conta}
                    regra={r}
                    onSalvo={recarregar}
                  />
                ))}
                {busca && visiveis.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted">
                      Nenhuma regra com esse filtro
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
