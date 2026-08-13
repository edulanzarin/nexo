"use client";

import { useMemo, useState } from "react";
import { Check, Search, Users, X } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui";
import type { DpColaborador } from "@/lib/dp-tipos";
import { num } from "@/lib/format";

interface Props {
  /** Ranking já carregado — é a fonte dos funcionários da Navecon. */
  dados: DpColaborador[] | undefined;
  valor: number | null;
  onMudar: (codigo: number | null) => void;
}

/**
 * Escolhe um funcionário da Navecon (o operador do Questor) para recortar o
 * dashboard. A lista sai do ranking já carregado — sem ida ao banco. Buscar por
 * nome; o "Sistema (automático)" (usuário 0) aparece por último.
 */
export function DpFuncionarioFiltro({ dados, valor, onMudar }: Props) {
  const [busca, setBusca] = useState("");

  const ordenados = useMemo(() => {
    if (!dados) return undefined;
    return [...dados].sort((a, b) => Number(a.auto) - Number(b.auto) || b.total - a.total);
  }, [dados]);

  const filtrados = useMemo(() => {
    if (!ordenados) return undefined;
    const q = busca.trim().toLowerCase();
    return q ? ordenados.filter((c) => c.nome.toLowerCase().includes(q)) : ordenados;
  }, [ordenados, busca]);

  const selecionado = valor != null ? dados?.find((c) => c.codigo === valor) : null;

  return (
    <div className="flex items-center gap-1">
      <Dropdown
        rotulo={selecionado ? selecionado.nome : "Todos os funcionários"}
        icone={<Users className="size-4 shrink-0 text-muted" />}
        ativo={valor != null}
        largura="w-80"
        larguraBotao="w-64"
      >
        {(fechar) => (
          <div>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar funcionário da Navecon…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              <ItemLista
                selecionado={valor == null}
                onClick={() => {
                  onMudar(null);
                  fechar();
                }}
              >
                <span className="grid size-4 shrink-0 place-items-center">
                  {valor == null && <Check className="size-4 stroke-[3] text-accent" />}
                </span>
                <span className="flex-1">Todos os funcionários</span>
              </ItemLista>

              {filtrados?.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">Nenhum funcionário encontrado</p>
              )}
              {filtrados?.map((c) => (
                <ItemLista
                  key={c.codigo}
                  selecionado={c.codigo === valor}
                  onClick={() => {
                    onMudar(c.codigo);
                    fechar();
                  }}
                >
                  <span className="grid size-4 shrink-0 place-items-center">
                    {c.codigo === valor && <Check className="size-4 stroke-[3] text-accent" />}
                  </span>
                  <span className="flex-1 truncate" title={c.nome}>
                    {c.nome}
                  </span>
                  {c.inativo && !c.auto && (
                    <Badge tone="critical" size="xs" uppercase className="shrink-0">
                      inativo
                    </Badge>
                  )}
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">{num(c.total)}</span>
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
          aria-label="Limpar funcionário"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
