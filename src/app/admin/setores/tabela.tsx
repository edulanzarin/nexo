"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Card } from "@/components/ui";
import type { SetorResumo } from "../dados";

const inputBusca =
  "h-9 w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";

export function SetoresTabela({ setores }: { setores: SetorResumo[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return setores;
    return setores.filter((s) => s.nome.toLowerCase().includes(q));
  }, [setores, busca]);

  return (
    <div>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar setor…"
          className={inputBusca}
        />
      </div>

      <Card padding="none" animate="none" overflow className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Setor</th>
                <th className="px-4 py-2.5 text-right font-medium">Cargos</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-muted">
                    Nenhum setor com esse filtro.
                  </td>
                </tr>
              )}
              {filtrados.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/admin/setores/${s.id}`)}
                  className="cursor-pointer border-b border-hairline last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5 font-medium">{s.nome}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-2">{s.cargos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
