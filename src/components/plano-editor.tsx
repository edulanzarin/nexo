"use client";

import { useState } from "react";
import { Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import type { LinhaPlano, PlanoCfop } from "@/lib/types";

/** Linha em edição — conta como texto para o campo aceitar digitação livre. */
interface LinhaEdit {
  natureza: 1 | -1;
  conta: string;
  variavel: boolean;
  rotulo: string;
}

function doPlano(plano: PlanoCfop): LinhaEdit[] {
  return plano.componentes.flatMap((c) =>
    c.linhas.map((l: LinhaPlano) => ({
      natureza: l.natureza,
      conta: l.conta != null ? String(l.conta) : "",
      variavel: l.contaVariavel,
      rotulo: l.descrConta ?? c.rotulo,
    }))
  );
}

interface Props {
  empresa: number;
  plano: PlanoCfop;
  /** Ex.: "matriz" ou "filial 0002" — mais legível que o código do estab. */
  rotuloEstab: string;
  onFechar: () => void;
  onSalvo: () => void;
}

/**
 * Editor do override de um CFOP. Abre pré-preenchido com o plano vigente (do
 * Questor ou do override já salvo); salvar passa a valer no lugar do Questor.
 */
export function PlanoEditor({ empresa, plano, rotuloEstab, onFechar, onSalvo }: Props) {
  const [contabiliza, setContabiliza] = useState(plano.contabiliza);
  const [linhas, setLinhas] = useState<LinhaEdit[]>(() => doPlano(plano));
  const [observacao, setObservacao] = useState(plano.observacao ?? "");
  const [salvando, setSalvando] = useState(false);

  function alterar(i: number, mudanca: Partial<LinhaEdit>) {
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, ...mudanca } : l)));
  }

  async function salvar() {
    if (contabiliza && !linhas.length) {
      toast.error("Adicione ao menos um lançamento ou marque como “não contabiliza”");
      return;
    }
    for (const [i, l] of linhas.entries()) {
      if (!l.variavel && !/^\d+$/.test(l.conta.trim())) {
        toast.error(`Lançamento ${i + 1}: informe a conta contábil`);
        return;
      }
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/contabil/plano", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          empresa,
          estab: plano.estab,
          cfop: plano.cfop,
          contabiliza,
          observacao: observacao.trim() || null,
          linhas: linhas.map((l) => ({
            natureza: l.natureza,
            conta: l.variavel ? null : Number(l.conta.trim()),
            origemConta: l.variavel ? 2 : 0,
            rotulo: l.rotulo.trim() || null,
          })),
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao salvar");
      toast.success(`Plano do CFOP ${plano.cfop} salvo`);
      onSalvo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function reverter() {
    setSalvando(true);
    try {
      const res = await fetch(
        `/api/contabil/plano?empresa=${empresa}&estab=${plano.estab}&cfop=${plano.cfop}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Falha ao reverter");
      toast.success("Voltou a seguir o plano do Questor");
      onSalvo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reverter");
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
            <h2 className="text-sm font-semibold">
              CFOP {plano.cfop}
              <span className="ml-2 text-xs font-normal text-muted">
                {rotuloEstab} · {plano.lado === "ent" ? "entrada" : "saída"}
              </span>
            </h2>
            <p className="mt-0.5 max-w-md text-xs text-muted">{plano.descricao ?? "—"}</p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-ink" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </header>

        <label className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
          <input
            type="checkbox"
            checked={contabiliza}
            onChange={(e) => setContabiliza(e.target.checked)}
            className="size-4 accent-current"
          />
          <span className="text-xs text-ink">
            Este CFOP deve gerar lançamento contábil
            <span className="block text-[11px] text-muted">
              Desmarque para remessa, retorno, comodato e afins — a conferência deixa de cobrar.
            </span>
          </span>
        </label>

        {contabiliza && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-2">Lançamentos esperados</p>
              <button
                onClick={() =>
                  setLinhas((a) => [...a, { natureza: 1, conta: "", variavel: false, rotulo: "" }])
                }
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink"
              >
                <Plus className="size-3.5" /> Adicionar
              </button>
            </div>

            {linhas.length === 0 && (
              <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-xs text-muted">
                Nenhum lançamento definido
              </p>
            )}

            {linhas.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2">
                {/* Binário: alternar em um clique é melhor que abrir uma lista. */}
                <div className="flex overflow-hidden rounded-md border border-hairline">
                  {([1, -1] as const).map((nat) => (
                    <button
                      key={nat}
                      type="button"
                      onClick={() => alterar(i, { natureza: nat })}
                      aria-pressed={l.natureza === nat}
                      className={clsx(
                        "px-2.5 py-1.5 text-xs transition-colors",
                        l.natureza === nat
                          ? nat === 1
                            ? "bg-accent/12 font-medium text-accent"
                            : "bg-sai/12 font-medium text-sai"
                          : "bg-surface text-muted hover:text-ink"
                      )}
                    >
                      {nat === 1 ? "Débito" : "Crédito"}
                    </button>
                  ))}
                </div>

                <input
                  value={l.variavel ? "" : l.conta}
                  onChange={(e) => alterar(i, { conta: e.target.value.replace(/\D/g, "") })}
                  disabled={l.variavel}
                  placeholder={l.variavel ? "fornecedor/cliente" : "conta"}
                  className="w-32 rounded-md border border-hairline bg-surface px-2 py-1.5 text-xs tabular-nums text-ink outline-none placeholder:text-muted disabled:text-muted"
                />

                <label className="flex items-center gap-1.5 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={l.variavel}
                    onChange={(e) => alterar(i, { variavel: e.target.checked })}
                    className="size-3.5 accent-current"
                  />
                  variável
                </label>

                <input
                  value={l.rotulo}
                  onChange={(e) => alterar(i, { rotulo: e.target.value })}
                  placeholder="rótulo (ICMS, mercadoria…)"
                  className="min-w-32 flex-1 rounded-md border border-hairline bg-surface px-2 py-1.5 text-xs text-ink outline-none placeholder:text-muted"
                />

                <button
                  onClick={() => setLinhas((a) => a.filter((_, j) => j !== i))}
                  className="text-muted hover:text-critical"
                  aria-label="Remover lançamento"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observação (por que este CFOP foge do padrão do Questor)"
          className="rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink outline-none placeholder:text-muted"
        />

        <footer className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
          {plano.origem === "override" ? (
            <button
              onClick={reverter}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" /> Voltar ao plano do Questor
            </button>
          ) : (
            <span className="text-[11px] text-muted">Seguindo o plano do Questor</span>
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onFechar} className="text-xs">
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={salvar}
              disabled={salvando}
              className={clsx("text-xs", salvando && "opacity-60")}
            >
              <Save className="size-3.5" /> Salvar override
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
