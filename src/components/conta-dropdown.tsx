"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import type { ContaPlano } from "@/lib/types";

async function buscarContas(empresa: number, busca: string, soBanco: boolean) {
  const p = new URLSearchParams({ empresa: String(empresa) });
  if (busca) p.set("busca", busca);
  if (soBanco) p.set("banco", "1");
  const res = await fetch(`/api/contabil/contas?${p}`);
  if (!res.ok) throw new Error("Falha ao buscar contas");
  return (await res.json()) as ContaPlano[];
}

interface Props {
  empresa: number;
  valor: number | null;
  onMudar: (conta: number | null) => void;
  /** Restringe às disponibilidades (caixa e bancos). */
  soBanco?: boolean;
  placeholder?: string;
  /** Permite deixar em branco — usado nas contrapartidas opcionais. */
  limpavel?: boolean;
  largura?: string;
}

/**
 * Escolhe uma conta do plano do Questor pesquisando por número ou descrição.
 * Digitar o número direto é arriscado (a conta pode não existir na empresa),
 * então aqui só se escolhe o que existe.
 */
export function ContaDropdown({
  empresa,
  valor,
  onMudar,
  soBanco,
  placeholder = "Selecionar conta",
  limpavel,
  largura = "w-96",
}: Props) {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isLoading } = useQuery({
    queryKey: ["contas", empresa, buscaDeb, soBanco ?? false],
    queryFn: () => buscarContas(empresa, buscaDeb, soBanco ?? false),
    enabled: Number.isInteger(empresa),
  });

  // Mostra a descrição da conta já escolhida mesmo antes de abrir a lista.
  const { data: atual } = useQuery({
    queryKey: ["conta-atual", empresa, valor],
    queryFn: () => buscarContas(empresa, String(valor), false),
    enabled: valor != null && Number.isInteger(empresa),
  });
  const descr = atual?.find((c) => c.conta === valor)?.descricao;

  return (
    <div className="flex items-center gap-1">
      <Dropdown
        rotulo={valor == null ? placeholder : `${valor} · ${descr ?? "…"}`}
        ativo={valor != null}
        largura={largura}
      >
        {(fechar) => (
          <div>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número ou descrição da conta…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {isLoading && <p className="px-3 py-2 text-sm text-muted">Carregando…</p>}
              {data?.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">Nenhuma conta encontrada</p>
              )}
              {data?.map((c) => (
                <ItemLista
                  key={c.conta}
                  selecionado={c.conta === valor}
                  onClick={() => {
                    onMudar(c.conta);
                    fechar();
                  }}
                >
                  <span className="grid size-4 shrink-0 place-items-center">
                    {c.conta === valor && <Check className="size-4 stroke-[3] text-accent" />}
                  </span>
                  <span className="tnum w-16 shrink-0 text-xs text-muted">{c.conta}</span>
                  <span className="flex-1 truncate" title={c.descricao}>
                    {c.descricao}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{c.classificacao}</span>
                </ItemLista>
              ))}
            </div>
          </div>
        )}
      </Dropdown>
      {limpavel && valor != null && (
        <button
          onClick={() => onMudar(null)}
          className="text-muted hover:text-critical"
          aria-label="Limpar conta"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
