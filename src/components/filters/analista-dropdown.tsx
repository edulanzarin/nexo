"use client";

import { useMemo, useState } from "react";
import { Check, Search, UserRound } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { useAnalistasCarteira } from "@/hooks/use-api";
import { SEM_RESPONSAVEL } from "@/lib/carteira-setores-tipos";

const ROTULO_SEM_RESPONSAVEL = "Sem responsável";

/**
 * Filtro por ANALISTA — o responsável pelo setor Contábil na carteira do
 * Acessórias, o mesmo nome da coluna Analista.
 *
 * O valor é o NOME como o Acessórias escreve, não um id: é o que a carteira
 * guarda, e é o que a tela mostra. Marcadores de fluxo ("Entrada Empresas")
 * aparecem na lista como qualquer analista, pelo mesmo motivo do ranking —
 * escondê-los esconderia quantas empresas estão sem dono de verdade. As empresas
 * sem responsável nenhum são uma opção própria, no fim.
 *
 * Multi-seleção porque carteiras se somam (união): cobrar um time é marcar os
 * nomes dele. Vazio = sem recorte.
 */
export function AnalistaDropdown({
  analistas,
  onChange,
}: {
  analistas: string[];
  onChange: (analistas: string[]) => void;
}) {
  const { data } = useAnalistasCarteira();
  const [busca, setBusca] = useState("");
  const lista = data?.analistas;

  const opcoes = useMemo(
    () =>
      (lista ?? []).map((a) => ({
        valor: a.nome ?? SEM_RESPONSAVEL,
        rotulo: a.nome ?? ROTULO_SEM_RESPONSAVEL,
        empresas: a.empresas,
      })),
    [lista]
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? opcoes.filter((o) => o.rotulo.toLowerCase().includes(q)) : opcoes;
  }, [opcoes, busca]);

  const rotulo =
    analistas.length === 0
      ? "Analista"
      : analistas.length === 1
        ? analistas[0] === SEM_RESPONSAVEL
          ? ROTULO_SEM_RESPONSAVEL
          : analistas[0]
        : `${analistas.length} analistas`;

  const toggle = (valor: string) => {
    const s = new Set(analistas);
    if (s.has(valor)) s.delete(valor);
    else s.add(valor);
    onChange([...s].sort((a, b) => a.localeCompare(b, "pt-BR")));
  };

  return (
    <Dropdown
      icone={<UserRound className="size-4" />}
      rotulo={rotulo}
      ativo={analistas.length > 0}
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
              placeholder="Buscar analista…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            {analistas.length > 0 && (
              <Button variant="link" onClick={() => onChange([])} className="shrink-0 text-xs">
                Limpar
              </Button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {!lista && <p className="px-3 py-2 text-sm text-muted">Carregando analistas…</p>}
            {lista && lista.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted">
                Carteira vazia — atualize a carteira do Acessórias no painel abaixo.
              </p>
            )}
            {lista && lista.length > 0 && filtradas.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">Nenhum analista encontrado</p>
            )}
            {filtradas.map((o) => {
              const marcado = analistas.includes(o.valor);
              return (
                <ItemLista key={o.valor} selecionado={marcado} onClick={() => toggle(o.valor)}>
                  <span
                    className={clsx(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      marcado ? "border-accent bg-accent text-white" : "border-baseline"
                    )}
                  >
                    {marcado && <Check className="size-3 stroke-[3]" />}
                  </span>
                  <span
                    className={clsx(
                      "flex-1 truncate",
                      o.valor === SEM_RESPONSAVEL && "text-muted"
                    )}
                  >
                    {o.rotulo}
                  </span>
                  <span className="tnum text-xs text-muted">{o.empresas} emp.</span>
                </ItemLista>
              );
            })}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
