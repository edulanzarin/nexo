"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Download, Search } from "lucide-react";
import { usePostMortens } from "@/hooks/use-api";
import { dataBR } from "@/lib/format";
import { exportarCSV } from "@/lib/exportar";
import { CriticidadeBadge, GravidadeBadge, StatusPmBadge } from "@/components/postmortem-badge";
import { Button, Card } from "@/components/ui";
import type { ModuloId } from "@/lib/modulos";
import { temCampo } from "@/lib/postmortem-setores";
import {
  CRITICIDADES,
  CRITICIDADE_ROTULO,
  type Criticidade,
  type StatusPM,
} from "@/lib/postmortem-tipos";

/**
 * A lista da seção `post-mortem-gestao`: todos os relatórios DO SETOR, de
 * qualquer analista. É a tela do gestor da área — por isso o autor é coluna, e
 * por isso ela tem exportação (a leitura da área inteira é o que se leva pra
 * reunião).
 *
 * Criticidade, situação e busca filtram no cliente, sobre a lista já carregada:
 * a lista é de um setor só, e mexer nesses recortes não vale uma ida ao banco.
 */
export function ListaGestao({
  modulo,
  setor,
  rotulo,
}: {
  modulo: ModuloId;
  setor: string;
  rotulo: string;
}) {
  const router = useRouter();
  const [crit, setCrit] = useState<Criticidade | "">("");
  const [status, setStatus] = useState<StatusPM | "">("");
  const [busca, setBusca] = useState("");

  const q = usePostMortens(modulo, "post-mortem-gestao");
  const mostraGravidade = temCampo(setor, "gravidade");
  const base = `/${modulo}/post-mortem-gestao`;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (crit && r.criticidade !== crit) return false;
      if (status && r.status !== status) return false;
      if (termo) {
        const alvo =
          `${r.empresaAfetada} ${r.autorNome} ${r.processo} ${r.grupoNome ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [q.data, crit, status, busca]);

  function exportar() {
    exportarCSV(
      modulo,
      `post-mortem-${setor}`,
      [
        "Nº",
        "Criticidade",
        ...(mostraGravidade ? ["Gravidade"] : []),
        "Analista",
        "Empresa afetada",
        "Grupo",
        "Processo",
        "Ocorrido",
        "Situação",
      ],
      filtrados.map((r) => [
        r.numero ? String(r.numero).padStart(4, "0") : "",
        r.criticidade ? CRITICIDADE_ROTULO[r.criticidade] : "",
        ...(mostraGravidade ? [r.gravidade ?? ""] : []),
        r.autorNome,
        r.empresaAfetada,
        r.grupoNome ?? "",
        r.processo,
        r.dataOcorrido ? dataBR(r.dataOcorrido) : "",
        r.status === "enviado" ? "Enviado" : "Rascunho",
      ])
    );
  }

  return (
    <Card as="section">
      <header className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Relatórios do {rotulo}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {q.data ? `${filtrados.length} de ${q.data.length} relatório(s)` : "…"}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="text-xs"
            onClick={exportar}
            disabled={!filtrados.length}
          >
            <Download className="size-3.5" /> Exportar CSV
          </Button>
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
      ) : !filtrados.length ? (
        <div className="grid place-items-center gap-2 py-14 text-center">
          <ClipboardList className="size-6 text-muted" />
          <p className="text-sm text-muted">
            {q.data?.length
              ? "Nenhum relatório com esse filtro."
              : `Nenhum relatório no ${rotulo} ainda.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pr-3 text-left font-medium">Nº</th>
                <th className="py-2 pr-3 text-left font-medium">Criticidade</th>
                {mostraGravidade && <th className="py-2 pr-3 text-left font-medium">Gravidade</th>}
                <th className="py-2 pr-3 text-left font-medium">Analista</th>
                <th className="py-2 pr-3 text-left font-medium">Empresa afetada</th>
                <th className="py-2 pr-3 text-left font-medium">Processo</th>
                <th className="py-2 pr-3 text-left font-medium">Ocorrido</th>
                <th className="py-2 pr-3 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
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
                  <td className="max-w-[160px] truncate py-2.5 pr-3 text-ink">{r.autorNome}</td>
                  <td className="max-w-[200px] truncate py-2.5 pr-3 text-ink-2">
                    {r.empresaAfetada || <span className="text-muted">—</span>}
                  </td>
                  <td className="max-w-[200px] truncate py-2.5 pr-3 text-ink-2">
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
