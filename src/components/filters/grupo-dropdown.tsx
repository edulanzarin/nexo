"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, FolderKanban, Search, Settings2 } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { useGruposEmpresa } from "@/hooks/use-api";

/**
 * Filtro por GRUPO de empresa — os grupos cadastrados em Configurações, os
 * mesmos para todo mundo. Manda só os IDs: quem traduz grupo em lista de
 * empresas é o servidor ([[escopo-no-funil-da-query]]), então marcar um grupo
 * não vaza a carteira dele para a URL nem depende do que o navegador sabe.
 *
 * Multi-seleção porque grupos se somam (união): "Comércio + Serviço" é uma
 * pergunta legítima. Vazio = sem recorte por grupo.
 *
 * Não confundir com os grupos LOCAIS do Fiscal (atalho pessoal no navegador):
 * aqueles expandem em empresas na hora; estes são cadastro compartilhado.
 */
export function GrupoDropdown({
  grupos,
  onChange,
  rotuloVazio = "Todos os grupos",
}: {
  grupos: number[];
  onChange: (grupos: number[]) => void;
  rotuloVazio?: string;
}) {
  const { data: lista } = useGruposEmpresa();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    if (!lista) return [];
    const q = busca.trim().toLowerCase();
    return q ? lista.filter((g) => g.nome.toLowerCase().includes(q)) : lista;
  }, [lista, busca]);

  const rotulo =
    grupos.length === 0
      ? rotuloVazio
      : grupos.length === 1
        ? (lista?.find((g) => g.id === grupos[0])?.nome ?? "1 grupo")
        : `${grupos.length} grupos`;

  const toggle = (id: number) => {
    const s = new Set(grupos);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    onChange([...s].sort((a, b) => a - b));
  };

  return (
    <Dropdown
      icone={<FolderKanban className="size-4" />}
      rotulo={rotulo}
      ativo={grupos.length > 0}
      largura="w-72"
    >
      {() => (
        <div>
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar grupo…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            {grupos.length > 0 && (
              <Button variant="link" onClick={() => onChange([])} className="shrink-0 text-xs">
                Limpar
              </Button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {!lista && <p className="px-3 py-2 text-sm text-muted">Carregando grupos…</p>}
            {lista && lista.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted">
                Nenhum grupo com empresas no seu acesso
              </p>
            )}
            {lista && lista.length > 0 && filtrados.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">Nenhum grupo encontrado</p>
            )}
            {filtrados.map((g) => {
              const marcado = grupos.includes(g.id);
              return (
                <ItemLista key={g.id} selecionado={marcado} onClick={() => toggle(g.id)}>
                  <span
                    className={clsx(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      marcado ? "border-accent bg-accent text-white" : "border-baseline"
                    )}
                  >
                    {marcado && <Check className="size-3 stroke-[3]" />}
                  </span>
                  <span className="flex-1 truncate">{g.nome}</span>
                  <span className="tnum text-xs text-muted">{g.empresas} emp.</span>
                </ItemLista>
              );
            })}
          </div>
          <div className="border-t border-hairline p-2">
            <Button asChild variant="ghost" className="w-full justify-start px-2.5 text-ink-2">
              <Link href="/config/grupos-empresa">
                <Settings2 className="size-4" />
                Gerenciar em Configurações
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Dropdown>
  );
}
