"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sair } from "@/app/login/actions";
import { normalizar } from "@/componentes/primitivos/combo";
import { Icone, type NomeIcone } from "@/componentes/primitivos/icone";
import { Tecla } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import { lerContexto, qsSoContexto } from "@/lib/contexto";
import { MODULOS, secoesDoModulo } from "@/lib/modulos";
import { useCasca } from "./casca-cliente";
import { definirTema } from "./tema";

const EVENTO = "navex:abrir-paleta";

export function abrirPaleta() {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export interface ItemPaleta {
  id: string;
  grupo: "Telas" | "Ações";
  rotulo: string;
  detalhe?: string;
  icone: NomeIcone | string;
  busca: string;
  agir: () => void;
}

/**
 * Paleta de comandos (Ctrl+K): ir para qualquer tela, seção ou aba, e as ações
 * da pessoa. Não busca empresa: empresa sozinha não é destino (no início, ia
 * para qual tela?), e trocar a empresa da tela em que se está é trabalho do
 * seletor do topo, que já traz as recentes e aceita o código.
 */
export function Paleta() {
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const router = useRouter();
  const sp = useSearchParams();
  const { acessos } = useCasca();
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Abrir sempre começa limpo: termo vazio e o primeiro item marcado.
    const abrir = () => {
      setTermo("");
      setAtivo(0);
      setAberta(true);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((a) => {
          if (!a) {
            setTermo("");
            setAtivo(0);
          }
          return !a;
        });
      }
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener(EVENTO, abrir);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener(EVENTO, abrir);
    };
  }, []);

  const itens = useMemo<ItemPaleta[]>(() => {
    // A tela leva junto o contexto em que a pessoa está (empresa, período).
    const qs = qsSoContexto(lerContexto(sp));
    const ir = (path: string) => () => router.push(`${path}${qs ? `?${qs}` : ""}`);
    const modulos = MODULOS.filter((m) => m.pronto && acessos[m.id]?.length);
    const secoes = modulos.flatMap((m) =>
      secoesDoModulo(m.id)
        .filter((s) => acessos[m.id]!.includes(s.id))
        .map((s) => ({ m, s }))
    );
    const telas: ItemPaleta[] = secoes.map(({ m, s }) => ({
      id: `s:${s.path}`,
      grupo: "Telas",
      rotulo: s.rotulo,
      detalhe: m.titulo,
      icone: s.icone,
      busca: normalizar(`${s.rotulo} ${m.titulo} ${s.descricao}`),
      agir: ir(s.path),
    }));
    // A aba que tem caminho próprio também é tela: "Envios" leva à aba Envios
    // de Formulários, e não à primeira aba da seção. A primeira aba divide o
    // caminho com a seção, e a seção já a representa.
    const abas: ItemPaleta[] = secoes.flatMap(({ m, s }) =>
      s.abas
        .filter((a) => a.path !== s.path)
        .map((a) => ({
          id: `aba:${a.path}`,
          grupo: "Telas" as const,
          rotulo: a.rotulo,
          detalhe: `${m.titulo} · ${s.rotulo}`,
          icone: s.icone,
          busca: normalizar(`${a.rotulo} ${s.rotulo} ${m.titulo} ${a.descricao}`),
          agir: ir(a.path),
        }))
    );
    const acoes: ItemPaleta[] = [
      { id: "a:noite", grupo: "Ações", rotulo: "Tema noite", icone: "noite", busca: "tema noite escuro", agir: () => definirTema("noite") },
      { id: "a:dia", grupo: "Ações", rotulo: "Tema dia", icone: "dia", busca: "tema dia claro", agir: () => definirTema("dia") },
      { id: "a:inicio", grupo: "Ações", rotulo: "Ir para o início", icone: "inicio", busca: "inicio home", agir: () => router.push("/") },
      { id: "a:sistema", grupo: "Ações", rotulo: "Catálogo de componentes", icone: "grade", busca: "catalogo sistema componentes", agir: () => window.open("/sistema", "_blank") },
      { id: "a:sair", grupo: "Ações", rotulo: "Sair", icone: "sair", busca: "sair logout", agir: () => void sair() },
    ];
    return [...telas, ...abas, ...acoes];
  }, [sp, acessos, router]);

  const filtrados = useMemo(() => {
    const t = normalizar(termo.trim());
    const partes = t.split(/\s+/).filter(Boolean);
    const casa = (i: ItemPaleta) => partes.every((p) => i.busca.includes(p));
    // Sem termo: as seções, que são o mapa. As abas entram quando se digita,
    // depois das seções que casam, para a lista vazia não virar um índice.
    if (!partes.length) return itens.filter((i) => i.grupo === "Telas" && i.id.startsWith("s:"));
    // Casar no nome vem antes de casar só na descrição: "férias" põe as telas
    // chamadas Férias na frente do painel que menciona férias vencidas.
    const peso = (i: ItemPaleta) => {
      const nome = normalizar(i.rotulo);
      if (partes.every((p) => nome.includes(p))) return nome.startsWith(partes[0]) ? 0 : 1;
      return 2;
    };
    const casam = itens.filter(casa).sort((a, b) => peso(a) - peso(b));
    return [...casam.filter((i) => i.grupo === "Telas").slice(0, 14), ...casam.filter((i) => i.grupo === "Ações")];
  }, [itens, termo]);

  useEffect(() => {
    lista.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  if (!aberta || typeof document === "undefined") return null;

  const escolher = (i: ItemPaleta | undefined) => {
    if (!i) return;
    setAberta(false);
    i.agir();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div
        aria-hidden
        className="absolute inset-0 animate-[nx-veu_160ms_ease-out] bg-[var(--veu)] backdrop-blur-[2px]"
        onClick={() => setAberta(false)}
      />
      <PainelPaleta
        termo={termo}
        onTermo={(t) => {
          setTermo(t);
          setAtivo(0);
        }}
        itens={filtrados}
        ativo={ativo}
        onAtivo={setAtivo}
        onEscolher={escolher}
        onFechar={() => setAberta(false)}
        entradaRef={entrada}
        listaRef={lista}
      />
    </div>,
    document.body
  );
}

/**
 * A aparência da paleta, sem o comportamento de abrir e fechar. Separada para o
 * catálogo mostrá-la aberta com a mesma peça (a paleta só existe aberta).
 */
export function PainelPaleta({
  termo,
  onTermo,
  itens,
  ativo,
  onAtivo,
  onEscolher,
  onFechar,
  entradaRef,
  listaRef,
  estatico,
}: {
  termo: string;
  onTermo: (t: string) => void;
  itens: ItemPaleta[];
  ativo: number;
  onAtivo: (i: number) => void;
  onEscolher: (i: ItemPaleta | undefined) => void;
  onFechar?: () => void;
  entradaRef?: React.Ref<HTMLInputElement>;
  listaRef?: React.Ref<HTMLDivElement>;
  estatico?: boolean;
}) {
  // O título do grupo aparece na primeira linha de cada grupo.
  const abreGrupo = itens.map((i, n) => n === 0 || itens[n - 1].grupo !== i.grupo);
  return (
    <div
      role="dialog"
      aria-label="Ir para"
      className={cn(
        "nx-flutua relative flex w-full max-w-xl flex-col overflow-hidden rounded-flutua",
        !estatico && "max-h-[70dvh] animate-[nx-modal_180ms_var(--ease-saida)]"
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") onFechar?.();
        else if (e.key === "ArrowDown") {
          e.preventDefault();
          onAtivo(Math.min(ativo + 1, itens.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onAtivo(Math.max(ativo - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          onEscolher(itens[ativo]);
        }
      }}
    >
      <div className="flex items-center gap-2.5 border-b border-linha px-4">
        <Icone nome="buscar" tamanho={17} className="text-apagado" />
        <input
          ref={entradaRef}
          autoFocus={!estatico}
          value={termo}
          onChange={(e) => onTermo(e.target.value)}
          placeholder="Buscar tela"
          className="h-12 min-w-0 flex-1 bg-transparent text-medio text-tinta placeholder:text-apagado focus:outline-none"
        />
        <Tecla>Esc</Tecla>
      </div>
      <div ref={listaRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {itens.length === 0 && (
          <p className="px-3 py-6 text-center text-corpo text-apagado italic">Nenhuma tela com esse nome.</p>
        )}
        {itens.map((i, n) => {
          const cabeca = abreGrupo[n];
          return (
            <div key={i.id}>
              {cabeca && (
                <p className="px-2.5 pt-2 pb-1 text-micro font-[600] text-apagado">
                  {i.grupo}
                </p>
              )}
              <button
                type="button"
                data-i={n}
                onMouseMove={() => onAtivo(n)}
                onClick={() => onEscolher(i)}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-controle px-2.5 text-left text-corpo",
                  n === ativo ? "bg-poco-forte text-tinta" : "text-tinta-2"
                )}
              >
                <Icone nome={i.icone} tamanho={16} className="text-apagado" />
                <span className="min-w-0 flex-1 truncate">{i.rotulo}</span>
                {i.detalhe && <span className="num shrink-0 text-pequeno text-apagado">{i.detalhe}</span>}
                {n === ativo && <Icone nome="enter" tamanho={14} className="text-apagado" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
