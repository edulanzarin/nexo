"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";

export interface Historico {
  codigo: number;
  descricao: string;
  pedeComplemento: boolean;
}

async function buscarHistoricos(busca: string): Promise<Historico[]> {
  const p = new URLSearchParams();
  if (busca) p.set("busca", busca);
  const res = await fetch(`/api/contabil/implantacao/historicos?${p}`);
  if (!res.ok) throw new Error("Falha ao buscar históricos");
  return (await res.json()) as Historico[];
}

interface Props {
  valor: number | null;
  /** Recebe o histórico escolhido (com pedeComplemento) ou null ao limpar. */
  onMudar: (h: Historico | null) => void;
  placeholder?: string;
  largura?: string;
}

/**
 * Escolhe um histórico padrão do Questor (`historicoctb`) pesquisando por número
 * ou descrição — digitar o código na mão é arriscado (pode não existir). Espelha
 * o `ContaDropdown`, mas o histórico é global (não depende da empresa).
 */
export function HistoricoDropdown({
  valor,
  onMudar,
  placeholder = "Selecionar histórico",
  largura = "w-96",
}: Props) {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isLoading } = useQuery({
    queryKey: ["historicos", buscaDeb],
    queryFn: () => buscarHistoricos(buscaDeb),
  });

  // Mostra a descrição do histórico já escolhido mesmo antes de abrir a lista.
  const { data: atual } = useQuery({
    queryKey: ["historico-atual", valor],
    queryFn: () => buscarHistoricos(String(valor)),
    enabled: valor != null,
  });
  const descr = atual?.find((h) => h.codigo === valor)?.descricao;

  return (
    <div className="flex items-center gap-1">
      <Dropdown
        rotulo={valor == null ? placeholder : `${valor} · ${descr ?? "…"}`}
        ativo={valor != null}
        largura={largura}
      >
        {(fechar) => (
          <div>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número ou descrição do histórico…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {isLoading && <p className="px-3 py-2 text-sm text-muted">Carregando…</p>}
              {data?.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">Nenhum histórico encontrado</p>
              )}
              {data?.map((h) => (
                <ItemLista
                  key={h.codigo}
                  selecionado={h.codigo === valor}
                  onClick={() => {
                    onMudar(h);
                    fechar();
                  }}
                >
                  <span className="grid size-4 shrink-0 place-items-center">
                    {h.codigo === valor && <Check className="size-4 stroke-[3] text-accent" />}
                  </span>
                  <span className="tnum w-12 shrink-0 text-xs text-muted">{h.codigo}</span>
                  <span className="flex-1 truncate" title={h.descricao}>
                    {h.descricao}
                  </span>
                </ItemLista>
              ))}
            </div>
          </div>
        )}
      </Dropdown>
      {valor != null && (
        <button
          onClick={() => onMudar(null)}
          className="text-muted hover:text-critical"
          aria-label="Limpar histórico"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
