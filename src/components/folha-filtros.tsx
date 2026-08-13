"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Briefcase, Clock, Layers, Search, IdCard, X } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import type { FolhaFiltros as Opcoes, FolhaOpcao } from "@/lib/types";
import type { FolhaSelecao } from "@/lib/folha-filtros";
import { contarFolhaSelecao, FOLHA_SELECAO_VAZIA } from "@/lib/folha-filtros";
import { num } from "@/lib/format";

function MultiSelect({
  icone,
  titulo,
  opcoes,
  selecionados,
  onToggle,
  onLimpar,
}: {
  icone: React.ReactNode;
  titulo: string;
  opcoes: FolhaOpcao[];
  selecionados: string[];
  onToggle: (valor: string) => void;
  onLimpar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const sel = new Set(selecionados);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter((o) => o.rotulo.toLowerCase().includes(q));
  }, [opcoes, busca]);

  const rotulo =
    selecionados.length === 0
      ? titulo
      : selecionados.length === 1
        ? (opcoes.find((o) => o.valor === selecionados[0])?.rotulo ?? `1 ${titulo}`)
        : `${titulo}: ${selecionados.length}`;

  return (
    <Dropdown icone={icone} rotulo={rotulo} ativo={selecionados.length > 0} largura="w-80">
      {() => (
        <div>
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar ${titulo.toLowerCase()}…`}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            {selecionados.length > 0 && (
              <button
                onClick={onLimpar}
                className="shrink-0 text-xs text-muted transition-colors hover:text-ink"
              >
                limpar
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtradas.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">Nada encontrado</p>
            )}
            {filtradas.slice(0, 200).map((o) => (
              <ItemLista key={o.valor} selecionado={sel.has(o.valor)} onClick={() => onToggle(o.valor)}>
                <span className="grid size-4 shrink-0 place-items-center">
                  {sel.has(o.valor) && <Check className="size-4 stroke-[3] text-accent" />}
                </span>
                <span className="flex-1 truncate">{o.rotulo}</span>
                <span className="tnum text-xs text-muted">{num(o.contratos)}</span>
              </ItemLista>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

/** Barra de filtros avançados da Folha: estabelecimento, setor, cargo e vínculo. */
export function FolhaFiltros({
  opcoes,
  sel,
  onChange,
}: {
  opcoes: Opcoes | undefined;
  sel: FolhaSelecao;
  onChange: (sel: FolhaSelecao) => void;
}) {
  if (!opcoes) return null;

  const toggle = (chave: keyof FolhaSelecao, valor: string) => {
    const atual = sel[chave];
    const novo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
    onChange({ ...sel, [chave]: novo });
  };
  const limpar = (chave: keyof FolhaSelecao) => onChange({ ...sel, [chave]: [] });

  const total = contarFolhaSelecao(sel);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Filtrar por:</span>
      <MultiSelect
        icone={<Building2 className="size-4" />}
        titulo="Estabelecimento"
        opcoes={opcoes.estabelecimentos}
        selecionados={sel.estabs}
        onToggle={(v) => toggle("estabs", v)}
        onLimpar={() => limpar("estabs")}
      />
      <MultiSelect
        icone={<Layers className="size-4" />}
        titulo="Setor"
        opcoes={opcoes.setores}
        selecionados={sel.setores}
        onToggle={(v) => toggle("setores", v)}
        onLimpar={() => limpar("setores")}
      />
      <MultiSelect
        icone={<Briefcase className="size-4" />}
        titulo="Cargo"
        opcoes={opcoes.cargos}
        selecionados={sel.cargos}
        onToggle={(v) => toggle("cargos", v)}
        onLimpar={() => limpar("cargos")}
      />
      <MultiSelect
        icone={<IdCard className="size-4" />}
        titulo="Vínculo"
        opcoes={opcoes.vinculos}
        selecionados={sel.vinculos}
        onToggle={(v) => toggle("vinculos", v)}
        onLimpar={() => limpar("vinculos")}
      />
      <MultiSelect
        icone={<Clock className="size-4" />}
        titulo="Horário"
        opcoes={opcoes.horarios}
        selecionados={sel.horarios}
        onToggle={(v) => toggle("horarios", v)}
        onLimpar={() => limpar("horarios")}
      />
      {total > 0 && (
        <button
          onClick={() => onChange(FOLHA_SELECAO_VAZIA)}
          className="flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-ink"
        >
          <X className="size-3.5" />
          Limpar ({total})
        </button>
      )}
    </div>
  );
}
