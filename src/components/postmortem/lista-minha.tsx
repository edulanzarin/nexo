"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Plus } from "lucide-react";
import { mutar } from "@/hooks/mutar";
import { usePostMortens } from "@/hooks/use-api";
import { dataBR } from "@/lib/format";
import { CriticidadeBadge, GravidadeBadge, StatusPmBadge } from "@/components/postmortem-badge";
import { Button, Card } from "@/components/ui";
import { temCampo } from "@/lib/postmortem-setores";

/**
 * A lista da seção `post-mortem`: os relatórios de QUEM ESTÁ OLHANDO, dentro do
 * setor do módulo. A posse é por linha (autor), então aqui não há filtro de
 * pessoa — quem lê o setor inteiro é o gestor, na seção Gestão ao lado.
 */
export function ListaMinha({ modulo, setor }: { modulo: string; setor: string }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const q = usePostMortens(modulo, "post-mortem");
  const mostraGravidade = temCampo(setor, "gravidade");
  const base = `/${modulo}/post-mortem`;

  async function novo() {
    setCriando(true);
    try {
      const { id } = await mutar<{ id: number }>(`/api/${modulo}/post-mortem`, "POST");
      router.push(`${base}/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setCriando(false);
    }
  }

  return (
    <Card as="section">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Meus relatórios</h2>
          <p className="mt-0.5 text-xs text-muted">
            Só os seus. A gestão do setor lê os de todo mundo.
          </p>
        </div>
        <Button variant="primary" size="sm" className="text-xs" onClick={novo} loading={criando}>
          {!criando && <Plus className="size-4" />}
          Novo relatório
        </Button>
      </header>

      {q.isLoading ? (
        <div className="skeleton h-64 w-full" />
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
                {mostraGravidade && <th className="py-2 pr-3 text-left font-medium">Gravidade</th>}
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
                  onClick={() => router.push(`${base}/${r.id}`)}
                  className="cursor-pointer border-b border-hairline/60 transition-colors last:border-0 hover:bg-surface-2/60"
                >
                  <td className="py-2.5 pr-3 tabular-nums">
                    {r.numero ? (
                      String(r.numero).padStart(4, "0")
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <CriticidadeBadge nivel={r.criticidade} />
                  </td>
                  {mostraGravidade && (
                    <td className="py-2.5 pr-3">
                      <GravidadeBadge nota={r.gravidade} />
                    </td>
                  )}
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
    </Card>
  );
}
