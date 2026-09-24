"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CASCA_CONTROLE } from "@/componentes/primitivos/campo";
import { Flutuante } from "@/componentes/primitivos/flutuante";
import { Icone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";
import { buscarJson } from "@/hooks/use-consulta";

export interface Historico {
  codigo: number;
  /** Descrição sem os marcadores `[DIC...]`. */
  descricao: string;
  /** A descrição tem marcador `[DIC...]`: o histórico pede texto complementar. */
  pedeComplemento: boolean;
}

function urlHistoricos(busca: string) {
  const p = new URLSearchParams();
  if (busca) p.set("busca", busca);
  return `/api/contabil/implantacao/historicos?${p}`;
}

/**
 * O histórico escolhido, com o que ele pede. A tela precisa saber se ele pede
 * complemento para mostrar (ou esconder) o campo de texto, inclusive quando o
 * código veio pronto do padrão da empresa e ninguém abriu a lista.
 */
export function useHistorico(codigo: number | null) {
  return useQuery({
    queryKey: ["historico", codigo],
    queryFn: () => buscarJson<Historico[]>(urlHistoricos(String(codigo))),
    enabled: codigo != null,
    staleTime: 10 * 60_000,
    select: (lista) => lista.find((h) => h.codigo === codigo) ?? null,
  });
}

/**
 * Escolhe um histórico padrão do Questor (`historicoctb`) buscando por número
 * ou descrição. São perto de dez mil e são do escritório, não da empresa; a
 * busca é no servidor. Só se escolhe o que existe: o código digitado à mão
 * pode não existir, e o Questor recusaria a importação inteira.
 */
export function SeletorHistorico({
  valor,
  onMudar,
  placeholder = "Escolher histórico",
  limpavel,
  className,
  desabilitado,
  rotuloAcessivel,
}: {
  valor: number | null;
  onMudar: (historico: Historico | null) => void;
  placeholder?: string;
  limpavel?: boolean;
  className?: string;
  desabilitado?: boolean;
  rotuloAcessivel?: string;
}) {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  // A lista só pergunta ao servidor com o seletor aberto: fechado, ele só
  // precisa descrever o histórico escolhido.
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 280);
    return () => clearTimeout(t);
  }, [busca]);

  const lista = useQuery({
    queryKey: ["historicos", termo],
    queryFn: () => buscarJson<Historico[]>(urlHistoricos(termo)),
    enabled: aberto,
    staleTime: 10 * 60_000,
  });
  const atual = useHistorico(valor);
  const itens = lista.data ?? [];

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Flutuante
        papel="listbox"
        larguraDaAncora
        larguraMin={420}
        onAberto={(a) => {
          setAberto(a);
          if (a) {
            setBusca("");
            setAtivo(0);
          }
        }}
        gatilho={(p) => (
          <button
            {...p}
            type="button"
            disabled={desabilitado}
            aria-label={rotuloAcessivel}
            className={cn(CASCA_CONTROLE, "flex min-w-0 items-center gap-2 text-left")}
          >
            {valor != null ? (
              <>
                <span className="num shrink-0 text-pequeno font-[600] text-apagado">{valor}</span>
                <span className="min-w-0 flex-1 truncate">
                  {atual.data?.descricao ?? (atual.isLoading ? "Carregando" : "Histórico não encontrado")}
                </span>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-apagado">{placeholder}</span>
            )}
            <Icone nome="abre-fecha" tamanho={14} className="text-apagado" />
          </button>
        )}
      >
        {(fechar) => (
          <div
            className="flex min-h-0 flex-col"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAtivo((a) => Math.min(a + 1, itens.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAtivo((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const h = itens[ativo];
                if (h) {
                  onMudar(h);
                  fechar();
                }
              }
            }}
          >
            <div className="border-b border-linha p-1.5">
              <div className="relative">
                <Icone
                  nome="buscar"
                  tamanho={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-apagado"
                />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setAtivo(0);
                  }}
                  placeholder="Número ou descrição do histórico"
                  className="h-8 w-full rounded-controle bg-poco pr-2 pl-8 text-corpo text-tinta placeholder:text-apagado focus:outline-none"
                />
              </div>
            </div>
            <div role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
              {lista.isLoading ? (
                <p className="px-2.5 py-3 text-pequeno text-apagado italic">Buscando nos históricos do Questor</p>
              ) : lista.isError ? (
                <p className="px-2.5 py-3 text-pequeno text-perigo">{(lista.error as Error).message}</p>
              ) : itens.length === 0 ? (
                <p className="px-2.5 py-3 text-pequeno text-apagado italic">Nenhum histórico com esse termo.</p>
              ) : (
                itens.map((h, i) => (
                  <div
                    key={h.codigo}
                    role="option"
                    aria-selected={h.codigo === valor}
                    onMouseEnter={() => setAtivo(i)}
                    onClick={() => {
                      onMudar(h);
                      fechar();
                    }}
                    className={cn(
                      "grid min-h-8 cursor-pointer grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 rounded-controle px-2.5 py-1 text-corpo",
                      i === ativo ? "bg-poco-forte text-tinta" : "text-tinta-2"
                    )}
                  >
                    <span className="num text-pequeno text-apagado">{h.codigo}</span>
                    <span className="truncate" title={h.descricao}>
                      {h.descricao}
                    </span>
                    {h.pedeComplemento ? (
                      <span className="text-micro text-apagado">com complemento</span>
                    ) : (
                      <span />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Flutuante>
      {limpavel && valor != null && (
        <button
          type="button"
          onClick={() => onMudar(null)}
          aria-label="Limpar histórico"
          className="grid size-7 shrink-0 place-items-center rounded-chip text-apagado hover:bg-perigo-suave hover:text-perigo"
        >
          <Icone nome="fechar" tamanho={14} />
        </button>
      )}
    </div>
  );
}
