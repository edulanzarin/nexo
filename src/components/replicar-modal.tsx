"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ContaDropdown } from "@/components/conta-dropdown";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { Button } from "@/components/ui";
import { useEmpresas } from "@/hooks/use-api";
import { num } from "@/lib/format";
import type { ContaBanco } from "@/lib/types";

interface Destino {
  empresa: number;
  empresaNome: string;
  conta: number | null;
}

interface Props {
  origem: ContaBanco;
  onFechar: () => void;
  onReplicado: () => void;
}

/** Avisa quais contrapartidas não existem no plano da empresa de destino. */
function Faltantes({ origem, empresa }: { origem: ContaBanco; empresa: number }) {
  const { data } = useQuery({
    queryKey: ["faltantes", origem.empresa, origem.conta, empresa],
    queryFn: async () => {
      const res = await fetch(
        `/api/contabil/extrato-regras?empresa=${origem.empresa}&faltantesDe=${origem.conta}&faltantesEm=${empresa}`
      );
      if (!res.ok) return { faltantes: [] as number[] };
      return (await res.json()) as { faltantes: number[] };
    },
  });
  if (!data?.faltantes.length) return null;
  return (
    <p className="mt-1 flex items-start gap-1.5 text-[11px] text-warning">
      <AlertTriangle className="mt-px size-3 shrink-0" />
      <span>
        Não existem no plano desta empresa: {data.faltantes.join(", ")}. As regras são copiadas
        mesmo assim, mas essas contas precisam ser ajustadas depois.
      </span>
    </p>
  );
}

/**
 * Copia as regras de uma conta de banco para outras contas ou empresas. O
 * plano de contas é por empresa, então a cópia leva os mesmos números — o que
 * funciona quando as empresas usam plano padrão, e por isso o aviso de contas
 * faltantes é mostrado por destino antes de confirmar.
 */
export function ReplicarModal({ origem, onFechar, onReplicado }: Props) {
  const { data: empresas } = useEmpresas();
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const validos = destinos.filter((d) => d.conta != null);

  async function replicar() {
    if (!validos.length) return toast.error("Escolha a conta de destino");
    setSalvando(true);
    try {
      const res = await fetch("/api/contabil/extrato-regras", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          acao: "replicar",
          empresa: origem.empresa,
          conta: origem.conta,
          destinos: validos.map((d) => ({ empresa: d.empresa, conta: d.conta })),
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao replicar");
      const total = corpo.resultado.reduce(
        (a: number, r: { criadas: number; atualizadas: number }) => a + r.criadas + r.atualizadas,
        0
      );
      toast.success(`${num(total)} regras replicadas para ${validos.length} conta(s)`);
      onReplicado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao replicar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="card flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Replicar regras</h2>
            <p className="mt-0.5 text-xs text-muted">
              {num(origem.regras.length)} regras de{" "}
              <span className="text-ink">{origem.apelido || origem.descricao}</span> (conta{" "}
              {origem.conta}) para outras contas ou empresas
            </p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-ink" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-3">
          {destinos.map((d, i) => (
            <div key={i} className="rounded-lg bg-surface-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Dropdown rotulo={d.empresaNome} largura="w-80">
                  {(fechar) => (
                    <div className="max-h-72 overflow-y-auto py-1">
                      {empresas?.map((e) => (
                        <ItemLista
                          key={e.codigo}
                          selecionado={e.codigo === d.empresa}
                          onClick={() => {
                            setDestinos((a) =>
                              a.map((x, j) =>
                                j === i
                                  ? { empresa: e.codigo, empresaNome: e.nome, conta: null }
                                  : x
                              )
                            );
                            fechar();
                          }}
                        >
                          <span className="flex-1 truncate">{e.nome}</span>
                          <span className="tnum text-xs text-muted">{e.codigo}</span>
                        </ItemLista>
                      ))}
                    </div>
                  )}
                </Dropdown>

                <ContaDropdown
                  empresa={d.empresa}
                  valor={d.conta}
                  onMudar={(conta) =>
                    setDestinos((a) => a.map((x, j) => (j === i ? { ...x, conta } : x)))
                  }
                  soBanco
                  placeholder="Conta de banco"
                  largura="w-80"
                />

                <button
                  onClick={() => setDestinos((a) => a.filter((_, j) => j !== i))}
                  className="ml-auto text-muted hover:text-critical"
                  aria-label="Remover destino"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Faltantes origem={origem} empresa={d.empresa} />
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDestinos((a) => [
                ...a,
                { empresa: origem.empresa, empresaNome: "Escolher empresa", conta: null },
              ])
            }
            className="self-start text-xs"
          >
            <Plus className="size-3.5" /> Adicionar destino
          </Button>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" size="sm" onClick={onFechar} className="text-xs">
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={replicar}
            disabled={salvando || !validos.length}
            className="text-xs"
          >
            <Copy className="size-3.5" /> Replicar para {validos.length || 0}
          </Button>
        </footer>
      </div>
    </div>
  );
}
