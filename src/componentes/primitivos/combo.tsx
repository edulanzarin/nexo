"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CASCA_CONTROLE } from "./campo";
import { Flutuante } from "./flutuante";
import { Icone, type NomeIcone } from "./icone";

export interface Opcao {
  valor: string;
  rotulo: string;
  /** Segunda informação da linha (código, CNPJ, contagem). Entra na busca. */
  detalhe?: string;
  icone?: NomeIcone;
  desabilitado?: boolean;
}

/** Tira acento e caixa: "Conciliação" casa com "conciliacao". */
export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtrarOpcoes(opcoes: Opcao[], termo: string): Opcao[] {
  const t = normalizar(termo.trim());
  if (!t) return opcoes;
  const partes = t.split(/\s+/);
  return opcoes.filter((o) => {
    const alvo = normalizar(`${o.rotulo} ${o.detalhe ?? ""} ${o.valor}`);
    return partes.every((p) => alvo.includes(p));
  });
}

const TETO_LISTA = 200;

/**
 * A lista navegável por teclado de dentro do combo. Mostra no máximo 200
 * linhas: a carteira tem 1.500 empresas, e desenhar todas trava a abertura; a
 * busca é o caminho para chegar no resto, e o rodapé diz isso.
 */
export function ListaOpcoes({
  opcoes,
  marcadas,
  multipla,
  onEscolher,
  busca,
  placeholderBusca = "Buscar",
  vazio = "Nada encontrado",
  topo,
}: {
  opcoes: Opcao[];
  marcadas: Set<string>;
  multipla?: boolean;
  onEscolher: (valor: string) => void;
  busca?: boolean;
  placeholderBusca?: string;
  vazio?: ReactNode;
  /** Algo fixo acima da lista (atalho "Todas", abas de modo). */
  topo?: ReactNode;
}) {
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const filtradas = useMemo(() => filtrarOpcoes(opcoes, termo), [opcoes, termo]);
  const visiveis = filtradas.slice(0, TETO_LISTA);

  useEffect(() => {
    if (busca) buscaRef.current?.focus();
    else listaRef.current?.focus();
  }, [busca]);

  useEffect(() => {
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const mover = (delta: number) =>
    setAtivo((a) => Math.min(Math.max(a + delta, 0), Math.max(visiveis.length - 1, 0)));

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mover(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mover(-1);
    } else if (e.key === "Home") {
      setAtivo(0);
    } else if (e.key === "End") {
      setAtivo(visiveis.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = visiveis[ativo];
      if (o && !o.desabilitado) onEscolher(o.valor);
    }
  };

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={aoTeclar}>
      {busca && (
        <div className="border-b border-linha p-1.5">
          <div className="relative">
            <Icone
              nome="buscar"
              tamanho={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-apagado"
            />
            <input
              ref={buscaRef}
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setAtivo(0);
              }}
              placeholder={placeholderBusca}
              className="h-8 w-full rounded-controle bg-poco pr-2 pl-8 text-corpo text-tinta placeholder:text-apagado focus:outline-none"
            />
          </div>
        </div>
      )}
      {topo}
      <div
        ref={listaRef}
        tabIndex={busca ? -1 : 0}
        role="listbox"
        aria-multiselectable={multipla || undefined}
        className="min-h-0 flex-1 overflow-y-auto p-1 focus:outline-none"
      >
        {visiveis.length === 0 ? (
          <p className="px-2.5 py-3 text-pequeno text-apagado italic">{vazio}</p>
        ) : (
          visiveis.map((o, i) => {
            const marcada = marcadas.has(o.valor);
            return (
              <div
                key={o.valor}
                role="option"
                aria-selected={marcada}
                aria-disabled={o.desabilitado || undefined}
                data-indice={i}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => !o.desabilitado && onEscolher(o.valor)}
                className={cn(
                  "flex min-h-8 cursor-pointer items-center gap-2 rounded-controle px-2.5 py-1 text-corpo",
                  i === ativo ? "bg-poco-forte text-tinta" : "text-tinta-2",
                  o.desabilitado && "cursor-not-allowed opacity-45"
                )}
              >
                {multipla ? (
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-[4px] border",
                      marcada ? "border-rota bg-rota text-fundo" : "border-linha-forte"
                    )}
                  >
                    {marcada && <Icone nome="certo" tamanho={14} className="size-3" />}
                  </span>
                ) : null}
                {o.icone && <Icone nome={o.icone} tamanho={15} className="text-apagado" />}
                <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
                {o.detalhe && (
                  <span className="num shrink-0 text-pequeno text-apagado">{o.detalhe}</span>
                )}
                {!multipla && marcada && <Icone nome="certo" tamanho={15} className="text-rota" />}
              </div>
            );
          })
        )}
        {filtradas.length > TETO_LISTA && (
          <p className="px-2.5 py-2 text-pequeno text-apagado italic">
            Mais {filtradas.length - TETO_LISTA} resultados. Refine a busca.
          </p>
        )}
      </div>
    </div>
  );
}

/** Rótulo do botão do combo: o texto escolhido, ou o placeholder apagado. */
function TextoGatilho({ texto, vazio }: { texto?: string; vazio: string }) {
  return (
    <span className={cn("min-w-0 flex-1 truncate text-left", !texto && "text-apagado")}>
      {texto ?? vazio}
    </span>
  );
}

/**
 * Escolha única. Busca liga sozinha com mais de oito opções: abaixo disso a
 * lista inteira cabe no olho e o campo só atrasa.
 */
export function Combo({
  opcoes,
  valor,
  onMudar,
  placeholder = "Escolher",
  busca,
  icone,
  larguraMin = 220,
  className,
  desabilitado,
  rotuloAcessivel,
  vazio,
}: {
  opcoes: Opcao[];
  valor: string | null;
  onMudar: (valor: string) => void;
  placeholder?: string;
  busca?: boolean;
  icone?: NomeIcone;
  larguraMin?: number;
  className?: string;
  desabilitado?: boolean;
  rotuloAcessivel?: string;
  vazio?: ReactNode;
}) {
  const escolhida = opcoes.find((o) => o.valor === valor);
  const comBusca = busca ?? opcoes.length > 8;
  return (
    <Flutuante
      papel="listbox"
      larguraDaAncora
      larguraMin={larguraMin}
      gatilho={(p) => (
        <button
          {...p}
          type="button"
          disabled={desabilitado}
          aria-label={rotuloAcessivel}
          className={cn(CASCA_CONTROLE, "flex items-center gap-2 text-left", className)}
        >
          {icone && <Icone nome={icone} tamanho={15} className="text-apagado" />}
          <TextoGatilho texto={escolhida?.rotulo} vazio={placeholder} />
          <Icone nome="abre-fecha" tamanho={14} className="text-apagado" />
        </button>
      )}
    >
      {(fechar) => (
        <ListaOpcoes
          opcoes={opcoes}
          marcadas={new Set(valor != null ? [valor] : [])}
          busca={comBusca}
          vazio={vazio}
          onEscolher={(v) => {
            onMudar(v);
            fechar();
          }}
        />
      )}
    </Flutuante>
  );
}

/**
 * Escolha múltipla. Lista vazia quer dizer "todas", e o botão diz isso com a
 * palavra do domínio ("Todas as filiais"), não com "nenhuma selecionada".
 */
export function ComboMulti({
  opcoes,
  valor,
  onMudar,
  rotuloTodas = "Todas",
  plural = "selecionadas",
  busca,
  icone,
  larguraMin = 240,
  className,
  desabilitado,
  rotuloAcessivel,
}: {
  opcoes: Opcao[];
  valor: string[];
  onMudar: (valor: string[]) => void;
  rotuloTodas?: string;
  plural?: string;
  busca?: boolean;
  icone?: NomeIcone;
  larguraMin?: number;
  className?: string;
  desabilitado?: boolean;
  rotuloAcessivel?: string;
}) {
  const marcadas = new Set(valor);
  const texto =
    valor.length === 0
      ? rotuloTodas
      : valor.length === 1
        ? (opcoes.find((o) => o.valor === valor[0])?.rotulo ?? `1 ${plural}`)
        : `${valor.length} ${plural}`;
  const comBusca = busca ?? opcoes.length > 8;
  const alternar = (v: string) =>
    onMudar(marcadas.has(v) ? valor.filter((x) => x !== v) : [...valor, v]);

  return (
    <Flutuante
      papel="listbox"
      larguraDaAncora
      larguraMin={larguraMin}
      gatilho={(p) => (
        <button
          {...p}
          type="button"
          disabled={desabilitado}
          aria-label={rotuloAcessivel}
          className={cn(CASCA_CONTROLE, "flex items-center gap-2 text-left", className)}
        >
          {icone && <Icone nome={icone} tamanho={15} className="text-apagado" />}
          <TextoGatilho texto={texto} vazio={rotuloTodas} />
          {valor.length > 1 && (
            <span className="num rounded-chip bg-rota-suave px-1.5 text-micro font-semibold text-rota">
              {valor.length}
            </span>
          )}
          <Icone nome="abre-fecha" tamanho={14} className="text-apagado" />
        </button>
      )}
    >
      {(fechar) => (
        <>
          <ListaOpcoes
            opcoes={opcoes}
            marcadas={marcadas}
            multipla
            busca={comBusca}
            onEscolher={alternar}
          />
          <div className="flex items-center justify-between gap-2 border-t border-linha px-2 py-1.5">
            <button
              type="button"
              onClick={() => onMudar([])}
              className="rounded-chip px-1.5 py-1 text-pequeno text-apagado hover:text-tinta"
            >
              {rotuloTodas}
            </button>
            <button
              type="button"
              onClick={fechar}
              className="rounded-chip px-2 py-1 text-pequeno font-semibold text-rota hover:bg-rota-suave"
            >
              Pronto
            </button>
          </div>
        </>
      )}
    </Flutuante>
  );
}
