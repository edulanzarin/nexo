"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { num } from "@/lib/format";
import type { Faceta } from "@/lib/types";

interface Props {
  rotulo: string;
  icone?: React.ReactNode;
  opcoes: Faceta[];
  selecionados: string[];
  onMudar: (valores: string[]) => void;
  /** Mostra campo de busca quando a lista é grande demais para varrer com o olho. */
  buscavel?: boolean;
  largura?: string;
}

/**
 * Filtro de múltipla escolha alimentado pelos valores que existem de fato nos
 * dados (com a contagem de cada um) — em vez de um campo livre onde se digita
 * no escuro e se descobre depois que não havia nada com aquele valor.
 */
export function FacetaDropdown({
  rotulo,
  icone,
  opcoes,
  selecionados,
  onMudar,
  buscavel,
  largura = "w-72",
}: Props) {
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter(
      (o) => o.valor.toLowerCase().includes(q) || (o.rotulo ?? "").toLowerCase().includes(q)
    );
  }, [opcoes, busca]);

  const alternar = (valor: string) =>
    onMudar(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor]
    );

  const texto =
    selecionados.length === 0
      ? rotulo
      : selecionados.length === 1
        ? selecionados[0]
        : `${rotulo}: ${selecionados.length}`;

  return (
    <Dropdown icone={icone} rotulo={texto} ativo={selecionados.length > 0} largura={largura}>
      {() => (
        <div>
          {buscavel && (
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto py-1">
            {visiveis.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">Nenhuma opção</p>
            )}
            {visiveis.slice(0, 300).map((o) => (
              <ItemLista
                key={o.valor}
                selecionado={selecionados.includes(o.valor)}
                onClick={() => alternar(o.valor)}
              >
                <span className="grid size-4 shrink-0 place-items-center">
                  {selecionados.includes(o.valor) && (
                    <Check className="size-4 stroke-[3] text-accent" />
                  )}
                </span>
                <span className="flex-1 truncate" title={o.rotulo ?? o.valor}>
                  {o.valor}
                  {o.rotulo && <span className="ml-1.5 text-xs text-muted">{o.rotulo}</span>}
                </span>
                <span className="tnum text-xs text-muted">{num(o.qtd)}</span>
              </ItemLista>
            ))}
            {visiveis.length > 300 && (
              <p className="px-3 py-2 text-xs text-muted">
                Mostrando 300 de {num(visiveis.length)} — refine a busca
              </p>
            )}
          </div>
          {selecionados.length > 0 && (
            <div className="border-t border-hairline p-2">
              <button
                onClick={() => onMudar([])}
                className="h-8 w-full rounded-md bg-surface-2 text-xs text-ink-2 transition-colors hover:text-ink"
              >
                Limpar seleção
              </button>
            </div>
          )}
        </div>
      )}
    </Dropdown>
  );
}
