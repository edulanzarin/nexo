"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import clsx from "clsx";
import { FichaModal } from "@/components/folha-ficha-modal";
import { PessoasTabela } from "@/components/folha-pessoas-tabela";
import { useMovimentacoes } from "@/hooks/use-api";
import { exportarCSV } from "@/lib/exportar";
import { dataBR, num } from "@/lib/format";
import type { FolhaMovimentacao } from "@/lib/types";

type Escopo = "movimentacoes" | "efetivo";
type Filtro = "todos" | "admitidos" | "desligados";

interface Props {
  /** qs com período + filtros avançados. */
  qs: string;
  /** Módulo dono das rotas (Folha padrão; RH usa /api/rh/*). */
  modulo?: "folha" | "rh";
}

/**
 * Duas visões da mesma equipe: **Movimentações** (quem entrou/saiu no período) e
 * **Efetivo atual** (todos os ativos no fim do período). Em ambas, clicar numa
 * linha abre a ficha; dá para exportar a lista visível em CSV. A empresa da
 * ficha vem da própria linha (o RH mistura NAVECON e FOUR).
 */
export function FolhaMovimentacoes({ qs, modulo = "folha" }: Props) {
  const [escopo, setEscopo] = useState<Escopo>("movimentacoes");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<FolhaMovimentacao | null>(null);

  const q = escopo === "efetivo" ? `${qs}&escopo=efetivo` : qs;
  const { data, isLoading, isFetching } = useMovimentacoes(q, true, modulo);

  const visiveis = useMemo(() => {
    if (!data) return undefined;
    const s = busca.trim().toLowerCase();
    return data.filter((m) => {
      if (escopo === "movimentacoes") {
        if (filtro === "admitidos" && !m.admitido) return false;
        if (filtro === "desligados" && !m.desligado) return false;
      }
      if (s && !m.nome.toLowerCase().includes(s) && !m.cargo.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [data, escopo, filtro, busca]);

  const nAdm = data?.filter((m) => m.admitido).length ?? 0;
  const nDes = data?.filter((m) => m.desligado).length ?? 0;

  const chips: { id: Filtro; rotulo: string }[] = [
    { id: "todos", rotulo: `Todos (${num(data?.length ?? 0)})` },
    { id: "admitidos", rotulo: `Admitidos (${num(nAdm)})` },
    { id: "desligados", rotulo: `Desligados (${num(nDes)})` },
  ];

  const exportar = () => {
    const linhas = (visiveis ?? []).map((m) => [
      m.nome,
      m.admitido ? "Admitido" : m.desligado ? "" : "Ativo",
      m.desligado ? "Desligado" : "",
      m.cargo,
      m.setor,
      dataBR(m.dataadm),
      m.datadem ? dataBR(m.datadem) : "",
      m.motivo ?? "",
      m.tempoCasaDias ?? "",
    ]);
    exportarCSV(
      modulo,
      escopo === "efetivo" ? "efetivo-folha" : "movimentacoes-folha",
      ["Nome", "Situação", "Desligado", "Cargo", "Setor", "Admissão", "Desligamento", "Motivo", "Tempo de casa (dias)"],
      linhas
    );
  };

  return (
    <section className="card anim-fade-up p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {escopo === "efetivo" ? "Efetivo atual" : "Movimentações no período"}
          </h2>
        </div>
        <button
          onClick={exportar}
          disabled={!visiveis || visiveis.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:text-ink disabled:opacity-40"
        >
          <Download className="size-3.5" />
          Exportar CSV
        </button>
      </header>

      {/* Alternador de visão */}
      <div className="mb-3 inline-flex rounded-lg border border-hairline bg-surface-2 p-0.5">
        {(["movimentacoes", "efetivo"] as Escopo[]).map((e) => (
          <button
            key={e}
            onClick={() => setEscopo(e)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs transition-colors",
              escopo === e ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {e === "movimentacoes" ? "Movimentações" : "Efetivo atual"}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {escopo === "movimentacoes" &&
          chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setFiltro(c.id)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                filtro === c.id
                  ? "border-ent/30 bg-accent/12 font-medium text-accent"
                  : "border-hairline bg-surface-2 text-muted hover:text-ink"
              )}
            >
              {c.rotulo}
            </button>
          ))}
        <label className="ml-auto flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5">
          <Search className="size-3.5 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome ou cargo…"
            className="w-44 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
          />
        </label>
      </div>

      {isLoading || !visiveis ? (
        <div className="skeleton h-80 w-full" />
      ) : visiveis.length === 0 ? (
        <p className="grid h-32 place-items-center text-sm text-muted">
          {escopo === "efetivo" ? "Nenhum colaborador ativo" : "Nenhuma movimentação no período"}
        </p>
      ) : (
        <PessoasTabela
          dados={visiveis}
          onAbrir={setAberto}
          recarregando={isFetching && !isLoading}
        />
      )}

      <FichaModal
        modulo={modulo}
        empresa={aberto?.codigoempresa ?? null}
        contrato={aberto?.contrato ?? null}
        onFechar={() => setAberto(null)}
      />
    </section>
  );
}
