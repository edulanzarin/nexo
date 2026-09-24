"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CASCA_CONTROLE } from "@/componentes/primitivos/campo";
import { Flutuante } from "@/componentes/primitivos/flutuante";
import { Icone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";
import type { ContaPlano } from "@/lib/types";
import { buscarJson } from "@/hooks/use-consulta";

function urlContas(empresa: number, busca: string, soBanco?: boolean) {
  const p = new URLSearchParams({ empresa: String(empresa) });
  if (busca) p.set("busca", busca);
  if (soBanco) p.set("banco", "1");
  return `/api/contabil/contas?${p}`;
}

/**
 * Escolhe uma conta analítica do plano da empresa, buscando por número,
 * classificação ou descrição no Questor. Só se escolhe o que existe: digitar o
 * número direto aceitaria conta que a empresa não tem.
 *
 * Serve a Conciliação (conta do banco e contrapartidas), o Plano de
 * contabilização e a Implantação.
 */
export function SeletorConta({
  empresa,
  valor,
  onMudar,
  soBanco,
  placeholder = "Escolher conta",
  limpavel,
  className,
  desabilitado,
  rotuloAcessivel,
}: {
  empresa: number;
  valor: number | null;
  onMudar: (conta: number | null, dados?: ContaPlano) => void;
  /** Só disponibilidades (caixa e bancos). */
  soBanco?: boolean;
  placeholder?: string;
  limpavel?: boolean;
  className?: string;
  desabilitado?: boolean;
  rotuloAcessivel?: string;
}) {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 280);
    return () => clearTimeout(t);
  }, [busca]);

  const contas = useQuery({
    queryKey: ["contas", empresa, termo, !!soBanco],
    queryFn: () => buscarJson<ContaPlano[]>(urlContas(empresa, termo, soBanco)),
    staleTime: 10 * 60_000,
  });
  // A descrição da conta escolhida, antes de abrir a lista.
  const atual = useQuery({
    queryKey: ["conta", empresa, valor],
    queryFn: () => buscarJson<ContaPlano[]>(urlContas(empresa, String(valor))),
    enabled: valor != null,
    staleTime: 10 * 60_000,
  });
  const escolhida = atual.data?.find((c) => c.conta === valor);
  const itens = contas.data ?? [];

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Flutuante
        papel="listbox"
        larguraDaAncora
        larguraMin={420}
        onAberto={(a) => {
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
                <span className="min-w-0 flex-1 truncate">{escolhida?.descricao ?? "Carregando"}</span>
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
                const c = itens[ativo];
                if (c) {
                  onMudar(c.conta, c);
                  fechar();
                }
              }
            }}
          >
            <div className="border-b border-linha p-1.5">
              <div className="relative">
                <Icone nome="buscar" tamanho={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-apagado" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setAtivo(0);
                  }}
                  placeholder="Número, classificação ou descrição"
                  className="h-8 w-full rounded-controle bg-poco pr-2 pl-8 text-corpo text-tinta placeholder:text-apagado focus:outline-none"
                />
              </div>
            </div>
            <div ref={lista} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
              {contas.isLoading ? (
                <p className="px-2.5 py-3 text-pequeno text-apagado italic">Buscando no plano da empresa</p>
              ) : contas.isError ? (
                <p className="px-2.5 py-3 text-pequeno text-perigo">{(contas.error as Error).message}</p>
              ) : itens.length === 0 ? (
                <p className="px-2.5 py-3 text-pequeno text-apagado italic">Nenhuma conta analítica com esse termo.</p>
              ) : (
                itens.map((c, i) => (
                  <div
                    key={c.conta}
                    role="option"
                    aria-selected={c.conta === valor}
                    onMouseEnter={() => setAtivo(i)}
                    onClick={() => {
                      onMudar(c.conta, c);
                      fechar();
                    }}
                    className={cn(
                      "grid min-h-8 cursor-pointer grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 rounded-controle px-2.5 py-1 text-corpo",
                      i === ativo ? "bg-poco-forte text-tinta" : "text-tinta-2"
                    )}
                  >
                    <span className="num text-pequeno text-apagado">{c.conta}</span>
                    <span className="truncate" title={c.descricao}>
                      {c.descricao}
                    </span>
                    <span className="num text-micro text-apagado">{c.classificacao}</span>
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
          aria-label="Limpar conta"
          className="grid size-7 shrink-0 place-items-center rounded-chip text-apagado hover:bg-perigo-suave hover:text-perigo"
        >
          <Icone nome="fechar" tamanho={14} />
        </button>
      )}
    </div>
  );
}
