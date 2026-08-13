"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import clsx from "clsx";
import type { EmpresaOpcao } from "@/app/admin/dados";

/**
 * Seleção pesquisável de empresas para dentro de um form. Substitui o
 * `<select multiple>` cru (impossível com 1476 empresas): busca por nome/código,
 * checklist e contador. Emite um `<input type="hidden" name={name}>` por empresa
 * marcada — inclusive as que a busca escondeu —, então o Server Action recebe a
 * seleção completa.
 */
export function EmpresaPicker({
  name,
  empresas,
  inicial,
}: {
  name: string;
  empresas: EmpresaOpcao[];
  inicial: number[];
}) {
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set(inicial));
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter(
      (e) => e.nome.toLowerCase().includes(q) || String(e.codigo).includes(q)
    );
  }, [empresas, busca]);

  const alternar = (codigo: number) =>
    setSelecionadas((prev) => {
      const s = new Set(prev);
      if (s.has(codigo)) s.delete(codigo);
      else s.add(codigo);
      return s;
    });

  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <Search className="size-4 text-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresa por nome ou código…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <span className="tnum shrink-0 text-xs text-muted">{selecionadas.size} selec.</span>
      </div>
      <div className="max-h-72 overflow-y-auto p-1">
        {filtradas.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted">Nenhuma empresa encontrada</p>
        )}
        {filtradas.slice(0, 300).map((e) => {
          const marcada = selecionadas.has(e.codigo);
          return (
            <button
              key={e.codigo}
              type="button"
              onClick={() => alternar(e.codigo)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
            >
              <span
                className={clsx(
                  "grid size-4 shrink-0 place-items-center rounded border",
                  marcada ? "border-accent bg-accent text-white" : "border-baseline"
                )}
              >
                {marcada && <Check className="size-3 stroke-[3]" />}
              </span>
              <span className="flex-1 truncate text-ink-2">{e.nome}</span>
              <span className="tnum text-xs text-muted">{e.codigo}</span>
            </button>
          );
        })}
        {filtradas.length > 300 && (
          <p className="px-2 py-2 text-xs text-muted">
            Mostrando 300 de {filtradas.length} — refine a busca (a seleção é mantida)
          </p>
        )}
      </div>
      {[...selecionadas].map((c) => (
        <input key={c} type="hidden" name={name} value={c} />
      ))}
    </div>
  );
}
