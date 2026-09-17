"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import clsx from "clsx";
import { Button, Segmented } from "@/components/ui";
import type { EmpresaOpcao } from "@/app/admin/dados";
import { codigosDoIntervalo } from "@/lib/selecao-intervalo";

/**
 * Seleção pesquisável de empresas para dentro de um form. Substitui o
 * `<select multiple>` cru (impossível com 1476 empresas): busca por nome/código,
 * checklist e contador. Emite um `<input type="hidden" name={name}>` por empresa
 * marcada — inclusive as que a busca escondeu —, então o Server Action recebe a
 * seleção completa.
 *
 * Controlado: quem usa guarda a seleção, porque o grupo precisa inverter as
 * marcações ao trocar de modo (ver `GrupoEmpresasCampo`).
 *
 * Feito para mexer em muitas de uma vez, porque grupo de empresa tem centenas:
 * marcar/desmarcar em lote vale para TUDO que a busca e a visão acharam (não só
 * as linhas desenhadas), a visão "Marcadas" revisa a seleção sem rolar 1.500
 * linhas, Shift+clique pega um intervalo e Enter na busca marca a única achada.
 */

/** Linhas desenhadas de cada vez; o lote vale para todas as filtradas. */
const LIMITE = 300;

type Visao = "todas" | "marcadas" | "desmarcadas";

export function EmpresaPicker({
  name,
  empresas,
  selecionadas,
  onMudar,
  rotuloContagem,
}: {
  name: string;
  empresas: EmpresaOpcao[];
  selecionadas: ReadonlySet<number>;
  onMudar: (selecionadas: Set<number>) => void;
  /** Texto do contador ao lado da busca (padrão "N selec."). */
  rotuloContagem?: string;
}) {
  const [busca, setBusca] = useState("");
  const [visao, setVisao] = useState<Visao>("todas");
  // Última empresa clicada sem Shift: a ponta de onde o intervalo parte.
  const [ancora, setAncora] = useState<number | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      if (visao === "marcadas" && !selecionadas.has(e.codigo)) return false;
      if (visao === "desmarcadas" && selecionadas.has(e.codigo)) return false;
      return !q || e.nome.toLowerCase().includes(q) || String(e.codigo).includes(q);
    });
  }, [empresas, busca, visao, selecionadas]);

  const visiveis = filtradas.slice(0, LIMITE);
  const marcadasNoFiltro = filtradas.filter((e) => selecionadas.has(e.codigo)).length;
  const recortado = busca.trim() !== "" || visao !== "todas";

  function aplicar(codigos: number[], marcar: boolean) {
    const s = new Set(selecionadas);
    for (const c of codigos) {
      if (marcar) s.add(c);
      else s.delete(c);
    }
    onMudar(s);
  }

  function clicar(codigo: number, shift: boolean) {
    // O intervalo inteiro vai para o estado que o clicado passa a ter.
    const marcar = !selecionadas.has(codigo);
    const codigos = shift
      ? codigosDoIntervalo(visiveis.map((e) => e.codigo), ancora, codigo)
      : [codigo];
    aplicar(codigos, marcar);
    setAncora(codigo);
  }

  // Contado sobre a lista, não sobre o Set: código marcado que saiu do cadastro
  // não aparece em visão nenhuma, então não pode entrar na conta.
  const marcadasNaLista = useMemo(
    () => empresas.filter((e) => selecionadas.has(e.codigo)).length,
    [empresas, selecionadas]
  );
  const contar = (v: Visao) =>
    v === "todas" ? empresas.length : v === "marcadas" ? marcadasNaLista : empresas.length - marcadasNaLista;

  const rotuloVisao = (texto: string, v: Visao) => (
    <>
      {texto} <span className="tnum text-muted">{contar(v)}</span>
    </>
  );

  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <Search className="size-4 text-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            // Enter dentro do form enviaria o grupo pela metade.
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (filtradas.length === 1) aplicar([filtradas[0].codigo], !selecionadas.has(filtradas[0].codigo));
          }}
          placeholder="Buscar empresa por nome ou código…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <span className="tnum shrink-0 text-xs text-muted">
          {rotuloContagem ?? `${selecionadas.size} selec.`}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-2 py-1.5">
        <Segmented
          size="sm"
          aria-label="Quais empresas mostrar"
          value={visao}
          onChange={setVisao}
          options={[
            { value: "todas", label: rotuloVisao("Todas", "todas") },
            { value: "marcadas", label: rotuloVisao("Marcadas", "marcadas") },
            { value: "desmarcadas", label: rotuloVisao("Desmarcadas", "desmarcadas") },
          ]}
        />
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={marcadasNoFiltro === filtradas.length}
            onClick={() => aplicar(filtradas.map((e) => e.codigo), true)}
          >
            {recortado ? `Marcar as ${filtradas.length}` : "Marcar todas"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={marcadasNoFiltro === 0}
            onClick={() => aplicar(filtradas.map((e) => e.codigo), false)}
          >
            {recortado ? `Desmarcar as ${filtradas.length}` : "Desmarcar todas"}
          </Button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-1">
        {filtradas.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted">Nenhuma empresa encontrada</p>
        )}
        {visiveis.map((e) => {
          const marcada = selecionadas.has(e.codigo);
          return (
            <button
              key={e.codigo}
              type="button"
              aria-pressed={marcada}
              onClick={(ev) => clicar(e.codigo, ev.shiftKey)}
              // Sem isto o Shift+clique seleciona o texto das linhas no caminho.
              onMouseDown={(ev) => ev.shiftKey && ev.preventDefault()}
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
        {filtradas.length > LIMITE && (
          <p className="px-2 py-2 text-xs italic text-muted">
            Mostrando {LIMITE} de {filtradas.length}. Marcar e desmarcar valem para as {filtradas.length}.
          </p>
        )}
      </div>

      <p className="border-t border-hairline px-3 py-1.5 text-[11px] italic text-muted">
        Shift+clique marca o intervalo. Com uma empresa só na busca, Enter marca ela.
      </p>

      {[...selecionadas].map((c) => (
        <input key={c} type="hidden" name={name} value={c} />
      ))}
    </div>
  );
}
