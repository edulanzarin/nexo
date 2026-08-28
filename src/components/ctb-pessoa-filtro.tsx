"use client";

import { useMemo, useState } from "react";
import { Check, Search, Users, X } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui";
import { num } from "@/lib/format";

/** O mínimo que o filtro precisa saber de alguém: quem é e quanto fez. Cada aba
 *  da Produtividade conta uma coisa diferente (lançamentos, exclusões, horas) e
 *  traduz para cá — assim o filtro serve as cinco sem conhecer nenhuma. */
export interface PessoaOpcao {
  codigo: number;
  nome: string;
  qtd: number;
}

/**
 * Escolhe uma pessoa do Contábil para recortar a tela. A lista sai do ranking já
 * carregado — sem ida ao banco, como no filtro de funcionário do DP.
 */
export function CtbPessoaFiltro({
  dados,
  valor,
  onMudar,
  rotuloTodos = "Todo o time",
}: {
  dados: PessoaOpcao[] | undefined;
  valor: number | null;
  onMudar: (codigo: number | null) => void;
  rotuloTodos?: string;
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    if (!dados) return undefined;
    const q = busca.trim().toLowerCase();
    return q ? dados.filter((p) => p.nome.toLowerCase().includes(q)) : dados;
  }, [dados, busca]);

  const selecionado = valor != null ? dados?.find((p) => p.codigo === valor) : null;

  return (
    <div className="flex items-center gap-1">
      <Dropdown
        rotulo={selecionado ? selecionado.nome : rotuloTodos}
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
                placeholder="Buscar por nome…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {!filtrados && <p className="px-3 py-2 text-sm text-muted">Carregando…</p>}
              {filtrados?.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">Ninguém com esse nome no período</p>
              )}
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
                <span className="flex-1 truncate text-muted">{rotuloTodos}</span>
              </ItemLista>
              {filtrados?.map((p) => (
                <ItemLista
                  key={p.codigo}
                  selecionado={p.codigo === valor}
                  onClick={() => {
                    onMudar(p.codigo);
                    fechar();
                  }}
                >
                  <span className="grid size-4 shrink-0 place-items-center">
                    {p.codigo === valor && <Check className="size-4 stroke-[3] text-accent" />}
                  </span>
                  <span className="flex-1 truncate">{p.nome}</span>
                  <span className="tnum text-xs text-muted">{num(p.qtd)}</span>
                </ItemLista>
              ))}
            </div>
          </div>
        )}
      </Dropdown>
      {valor != null && (
        <IconButton aria-label="Limpar pessoa" onClick={() => onMudar(null)}>
          <X className="size-4" />
        </IconButton>
      )}
    </div>
  );
}
