"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, ShieldCheck } from "lucide-react";
import { FacetaDropdown } from "@/components/filters/faceta-dropdown";
import { Badge, Card } from "@/components/ui";
import type { Faceta } from "@/lib/types";
import type { CargoResumo } from "../dados";

const inputBusca =
  "h-9 w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";

export function CargosTabela({ cargos }: { cargos: CargoResumo[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [setores, setSetores] = useState<string[]>([]);

  const facSetor = useMemo(() => {
    const cont = new Map<string, number>();
    for (const c of cargos) if (c.setorNome) cont.set(c.setorNome, (cont.get(c.setorNome) ?? 0) + 1);
    return [...cont.entries()]
      .map(([valor, qtd]): Faceta => ({ valor, rotulo: null, qtd }))
      .sort((a, b) => a.valor.localeCompare(b.valor));
  }, [cargos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cargos.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q)) return false;
      if (setores.length && !(c.setorNome && setores.includes(c.setorNome))) return false;
      return true;
    });
  }, [cargos, busca, setores]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cargo…"
            className={inputBusca}
          />
        </div>
        <FacetaDropdown
          rotulo="Setor"
          icone={<Building2 className="size-4" />}
          opcoes={facSetor}
          selecionados={setores}
          onMudar={setSetores}
        />
      </div>

      <Card padding="none" animate="none" overflow className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Cargo</th>
                <th className="px-4 py-2.5 font-medium">Setor</th>
                <th className="px-4 py-2.5 text-right font-medium">Seções</th>
                <th className="px-4 py-2.5 text-right font-medium">Grupos</th>
                <th className="px-4 py-2.5 text-right font-medium">Usuários</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Nenhum cargo com esses filtros.
                  </td>
                </tr>
              )}
              {filtrados.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/cargos/${c.id}`)}
                  className="cursor-pointer border-b border-hairline last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5 font-medium">
                    <span className="flex items-center gap-2">
                      {c.nome}
                      {c.admin && (
                        <Badge tone="ent" size="xs" className="shrink-0">
                          <ShieldCheck className="size-3" /> acesso total
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{c.setorNome ?? <span className="text-muted">—</span>}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-2">{c.secoes}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-2">{c.grupos}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-2">{c.usuarios}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
