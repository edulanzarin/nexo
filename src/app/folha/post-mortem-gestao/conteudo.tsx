"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { dataBR } from "@/lib/format";
import { CriticidadeBadge, StatusPmBadge } from "@/components/postmortem-badge";
import {
  CRITICIDADES,
  CRITICIDADE_ROTULO,
  type Criticidade,
  type ResumoPM,
  type StatusPM,
} from "@/lib/folha-postmortem-tipos";

async function buscarLista(url: string): Promise<ResumoPM[]> {
  const r = await fetch(url);
  if (!r.ok) {
    let m = `Erro ${r.status}`;
    try {
      const b = await r.json();
      if (b?.error) m = b.error;
    } catch {}
    throw new Error(m);
  }
  return r.json();
}

export default function Conteudo() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["pm", "todos"],
    queryFn: () => buscarLista("/api/folha/post-mortem"),
  });

  const [crit, setCrit] = useState<Criticidade | "">("");
  const [status, setStatus] = useState<StatusPM | "">("");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (crit && r.criticidade !== crit) return false;
      if (status && r.status !== status) return false;
      if (termo) {
        const alvo = `${r.empresaAfetada} ${r.autorNome} ${r.processo} ${r.grupoNome ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [q.data, crit, status, busca]);

  return (
    <section className="card anim-fade-up p-5">
      <header className="mb-4 flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Todos os relatórios</h2>
          <p className="mt-0.5 text-xs text-muted">
            {q.data ? `${q.data.length} relatório(s) no total` : "…"} · extração e indicadores por IA
            entram na próxima etapa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={crit}
            onChange={(e) => setCrit(e.target.value as Criticidade | "")}
            className="rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none"
          >
            <option value="">Toda criticidade</option>
            {CRITICIDADES.map((c) => (
              <option key={c} value={c}>
                {CRITICIDADE_ROTULO[c]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusPM | "")}
            className="rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs text-ink outline-none"
          >
            <option value="">Toda situação</option>
            <option value="enviado">Enviado</option>
            <option value="rascunho">Rascunho</option>
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5">
            <Search className="size-4 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Empresa, analista, processo…"
              className="w-52 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </header>

      {q.isLoading ? (
        <div className="skeleton h-64 w-full" />
      ) : q.error ? (
        <p className="py-10 text-center text-sm text-critical">{(q.error as Error).message}</p>
      ) : !filtrados.length ? (
        <div className="grid place-items-center gap-2 py-14 text-center">
          <ClipboardList className="size-6 text-muted" />
          <p className="text-sm text-muted">Nenhum relatório com esse filtro.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pr-3 text-left font-medium">Nº</th>
                <th className="py-2 pr-3 text-left font-medium">Criticidade</th>
                <th className="py-2 pr-3 text-left font-medium">Analista</th>
                <th className="py-2 pr-3 text-left font-medium">Empresa afetada</th>
                <th className="py-2 pr-3 text-left font-medium">Grupo</th>
                <th className="py-2 pr-3 text-left font-medium">Ocorrido</th>
                <th className="py-2 pr-3 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/folha/post-mortem/${r.id}`)}
                  className="cursor-pointer border-b border-hairline/60 transition-colors last:border-0 hover:bg-surface-2/60"
                >
                  <td className="py-2.5 pr-3 tabular-nums">
                    {r.numero ? String(r.numero).padStart(4, "0") : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <CriticidadeBadge nivel={r.criticidade} />
                  </td>
                  <td className="max-w-[160px] truncate py-2.5 pr-3 text-ink">{r.autorNome}</td>
                  <td className="max-w-[200px] truncate py-2.5 pr-3 text-ink-2">
                    {r.empresaAfetada || <span className="text-muted">—</span>}
                  </td>
                  <td className="max-w-[160px] truncate py-2.5 pr-3 text-ink-2">
                    {r.grupoNome || <span className="text-muted">—</span>}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                    {r.dataOcorrido ? dataBR(r.dataOcorrido) : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusPmBadge status={r.status} />
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
