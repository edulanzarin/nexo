"use client";

import { useMemo, useState } from "react";
import { Check, Network, Search } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { useGruposAcessorias } from "@/hooks/use-api";

/**
 * Filtro por GRUPO DE EMPRESA DO ACESSÓRIAS — o cadastro que o escritório já
 * mantém lá, no mesmo lugar em que mantém o cliente.
 *
 * Existe ao lado do [[GrupoDropdown]], que é o grupo do PRÓPRIO Nexo
 * (Configurações). Os dois são cadastros diferentes com o mesmo nome, e é por
 * isso que cada um se apresenta dizendo de onde vem: um dropdown escrito só
 * "Grupo" numa tela onde há dois é um convite a filtrar pelo errado e concluir
 * que o sistema perdeu empresa.
 *
 * Manda só os IDS: quem traduz grupo em CNPJs é o servidor, então marcar um
 * grupo não vaza a carteira dele para a URL.
 *
 * Multi-seleção porque grupos se somam (união). Vazio = sem recorte.
 */
export function GrupoAcessoriasDropdown({
  grupos,
  onChange,
}: {
  grupos: number[];
  onChange: (grupos: number[]) => void;
}) {
  const { data } = useGruposAcessorias();
  const [busca, setBusca] = useState("");
  const lista = data?.grupos;

  const filtrados = useMemo(() => {
    if (!lista) return [];
    const q = busca.trim().toLowerCase();
    return q ? lista.filter((g) => g.nome.toLowerCase().includes(q)) : lista;
  }, [lista, busca]);

  const rotulo =
    grupos.length === 0
      ? "Grupo do Acessórias"
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
      icone={<Network className="size-4" />}
      rotulo={rotulo}
      ativo={grupos.length > 0}
      largura="w-80"
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
                Nenhum grupo sincronizado ainda — atualize os grupos no painel da carteira.
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
                  <span className="flex-1 truncate">
                    {g.nome}
                    {!g.ativo && <span className="ml-1.5 text-xs text-muted">(inativo)</span>}
                  </span>
                  <span className="tnum text-xs text-muted">{g.empresas} emp.</span>
                </ItemLista>
              );
            })}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
