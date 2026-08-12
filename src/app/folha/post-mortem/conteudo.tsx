"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { mutar } from "@/hooks/mutar";
import { dataBR } from "@/lib/format";
import { CriticidadeBadge, StatusPmBadge } from "@/components/postmortem-badge";
import type { ResumoPM } from "@/lib/folha-postmortem-tipos";

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
  const [criando, setCriando] = useState(false);
  const q = useQuery({
    queryKey: ["pm", "meus"],
    queryFn: () => buscarLista("/api/folha/post-mortem"),
  });

  async function novo() {
    setCriando(true);
    try {
      const { id } = await mutar<{ id: number }>("/api/folha/post-mortem", "POST");
      router.push(`/folha/post-mortem/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setCriando(false);
    }
  }

  return (
    <section className="card anim-fade-up p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Meus relatórios</h2>
          <p className="mt-0.5 text-xs text-muted">
            Análise de incidente do DP — preencha sempre que houver erro, retrabalho ou não
            conformidade.
          </p>
        </div>
        <button
          onClick={novo}
          disabled={criando}
          className="flex items-center gap-1.5 rounded-lg bg-ent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-ent/90 disabled:opacity-60"
        >
          {criando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Novo relatório
        </button>
      </header>

      {q.isLoading ? (
        <div className="skeleton h-64 w-full" />
      ) : q.error ? (
        <p className="py-10 text-center text-sm text-critical">{(q.error as Error).message}</p>
      ) : !q.data?.length ? (
        <div className="grid place-items-center gap-2 py-14 text-center">
          <ClipboardList className="size-6 text-muted" />
          <p className="text-sm text-muted">Você ainda não tem relatórios. Comece um novo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pr-3 text-left font-medium">Nº</th>
                <th className="py-2 pr-3 text-left font-medium">Criticidade</th>
                <th className="py-2 pr-3 text-left font-medium">Empresa afetada</th>
                <th className="py-2 pr-3 text-left font-medium">Processo</th>
                <th className="py-2 pr-3 text-left font-medium">Ocorrido</th>
                <th className="py-2 pr-3 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((r) => (
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
                  <td className="max-w-[220px] truncate py-2.5 pr-3 text-ink">
                    {r.empresaAfetada || <span className="text-muted">—</span>}
                  </td>
                  <td className="max-w-[220px] truncate py-2.5 pr-3 text-ink-2">
                    {r.processo || <span className="text-muted">—</span>}
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
