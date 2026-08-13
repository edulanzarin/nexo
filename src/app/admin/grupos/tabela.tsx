"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { GrupoResumo } from "../dados";

const inputBusca =
  "h-9 w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";

export function GruposTabela({ grupos }: { grupos: GrupoResumo[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => g.nome.toLowerCase().includes(q));
  }, [grupos, busca]);

  return (
    <div>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar grupo…"
          className={inputBusca}
        />
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 text-right font-medium">Empresas</th>
                <th className="px-4 py-2.5 text-right font-medium">Cargos</th>
                <th className="px-4 py-2.5 text-right font-medium">Usuários</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Nenhum grupo com esse filtro.
                  </td>
                </tr>
              )}
              {filtrados.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => router.push(`/admin/grupos/${g.id}`)}
                  className="cursor-pointer border-b border-hairline last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5 font-medium">{g.nome}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-2">{g.empresas}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-2">{g.cargos}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-2">{g.usuarios}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
