"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

interface Opcao {
  id: number;
  nome: string;
}

/**
 * Combo com busca e criação inline: filtra as opções existentes e, se o texto
 * digitado não casa com nenhuma, oferece "Criar «texto»". Emite ao form:
 *   - `${name}_id`   quando uma opção existente é escolhida;
 *   - `${name}_novo` quando o usuário opta por criar uma nova.
 * Vazio = nenhum dos dois (ex.: "sem setor"). A criação de fato acontece no
 * Server Action, que faz upsert por nome.
 */
export function ComboCriavel({
  name,
  opcoes,
  inicial,
  placeholder = "Buscar ou criar…",
  criavel = true,
  onChange,
}: {
  name: string;
  opcoes: Opcao[];
  inicial?: Opcao | null;
  placeholder?: string;
  /** Quando false, vira só busca (não oferece "Criar"). */
  criavel?: boolean;
  /** Avisa o pai da escolha (opção existente, ou novo nome, ou nada). */
  onChange?: (opcao: Opcao | null, novo: string | null) => void;
}) {
  const [texto, setTexto] = useState(inicial?.nome ?? "");
  const [selId, setSelId] = useState<number | null>(inicial?.id ?? null);
  const [novo, setNovo] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = texto.trim().toLowerCase();
  const filtradas = useMemo(
    () => (q ? opcoes.filter((o) => o.nome.toLowerCase().includes(q)) : opcoes),
    [opcoes, q]
  );
  const casaExato = opcoes.some((o) => o.nome.toLowerCase() === q);

  const escolher = (o: Opcao) => {
    setSelId(o.id);
    setNovo(null);
    setTexto(o.nome);
    setAberto(false);
    onChange?.(o, null);
  };
  const criar = () => {
    setNovo(texto.trim());
    setSelId(null);
    setAberto(false);
    onChange?.(null, texto.trim());
  };
  const limparTudo = () => {
    setTexto("");
    setSelId(null);
    setNovo(null);
    onChange?.(null, null);
  };
  const aoDigitar = (v: string) => {
    setTexto(v);
    setSelId(null);
    setNovo(null);
    setAberto(true);
  };

  return (
    <div className="relative">
      <div className="flex h-10 items-center gap-1 rounded-lg border border-hairline bg-surface px-3 focus-within:border-accent/50">
        <input
          value={texto}
          onChange={(e) => aoDigitar(e.target.value)}
          onFocus={() => setAberto(true)}
          onBlur={() => {
            fecharTimer.current = setTimeout(() => setAberto(false), 120);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        {novo && (
          <span className="shrink-0 rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-medium text-accent">novo</span>
        )}
        {texto ? (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={limparTudo} className="shrink-0 text-muted hover:text-ink">
            <X className="size-4" />
          </button>
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted" />
        )}
      </div>

      {aberto && (
        <div
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-hairline bg-surface py-1 shadow-lg"
          onMouseEnter={() => fecharTimer.current && clearTimeout(fecharTimer.current)}
        >
          {filtradas.slice(0, 100).map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(o)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
            >
              <span className="grid size-4 shrink-0 place-items-center">
                {selId === o.id && <Check className="size-4 stroke-[3] text-accent" />}
              </span>
              <span className="flex-1 truncate">{o.nome}</span>
            </button>
          ))}
          {criavel && q && !casaExato && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={criar}
              className="flex w-full items-center gap-2 border-t border-hairline px-3 py-1.5 text-left text-sm text-accent transition-colors hover:bg-surface-2"
            >
              <Plus className="size-4 shrink-0" />
              Criar &quot;{texto.trim()}&quot;
            </button>
          )}
          {filtradas.length === 0 && !q && (
            <p className="px-3 py-2 text-sm text-muted">
              {criavel ? "Digite para buscar ou criar" : "Digite para buscar"}
            </p>
          )}
          {filtradas.length === 0 && q && !criavel && (
            <p className="px-3 py-2 text-sm text-muted">Nenhum encontrado</p>
          )}
        </div>
      )}

      {selId != null && <input type="hidden" name={`${name}_id`} value={selId} />}
      {novo && <input type="hidden" name={`${name}_novo`} value={novo} />}
    </div>
  );
}
