"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { ContaDropdown } from "@/components/conta-dropdown";
import type { RegraExtratoDTO } from "@/lib/types";

interface Props {
  empresa: number;
  /** Conta do banco no plano; o cadastro é criado no primeiro salvamento. */
  conta: number;
  /** `null` = linha em branco no fim da tabela, para cadastrar uma nova. */
  regra: RegraExtratoDTO | null;
  onSalvo: () => void;
}

/**
 * Uma regra na tabela. A linha vazia do fim vira uma regra nova ao salvar, o
 * que evita um modal só para acrescentar uma linha.
 */
export function RegraExtratoLinha({ empresa, conta, regra, onSalvo }: Props) {
  const nova = regra == null;
  const [termo, setTermo] = useState(regra?.termoOriginal ?? "");
  const [tipo, setTipo] = useState<"exato" | "parcial">(regra?.tipo ?? "parcial");
  const [pagamento, setPagamento] = useState<number | null>(regra?.contaPagamento ?? null);
  const [recebimento, setRecebimento] = useState<number | null>(regra?.contaRecebimento ?? null);
  const [salvando, setSalvando] = useState(false);

  const sujo =
    !nova &&
    (termo !== regra.termoOriginal ||
      tipo !== regra.tipo ||
      pagamento !== regra.contaPagamento ||
      recebimento !== regra.contaRecebimento);

  const podeSalvar = termo.trim().length > 0 && (pagamento != null || recebimento != null);

  async function salvar() {
    if (!podeSalvar) {
      toast.error("Informe o termo e ao menos uma conta de contrapartida");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/contabil/extrato-regras", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: regra?.id,
          empresa,
          conta,
          termo,
          tipo,
          contaPagamento: pagamento,
          contaRecebimento: recebimento,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao salvar");
      toast.success(nova ? "Regra criada" : "Regra atualizada");
      if (nova) {
        setTermo("");
        setPagamento(null);
        setRecebimento(null);
        setTipo("parcial");
      }
      onSalvo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!regra) return;
    const res = await fetch(`/api/contabil/extrato-regras?regra=${regra.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Falha ao remover");
    toast.success("Regra removida");
    onSalvo();
  }

  return (
    <tr
      className={clsx(
        "border-b border-hairline/60 align-middle last:border-0",
        nova && "bg-surface-2/30"
      )}
    >
      <td className="py-2 pr-3">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={nova ? "ex.: MAGALHAES" : ""}
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-xs text-ink outline-none placeholder:text-muted"
        />
      </td>
      <td className="py-2 pr-3">
        {/* Binário e frequente: alternar num clique é melhor que abrir lista. */}
        <div className="flex overflow-hidden rounded-md border border-hairline">
          {(["parcial", "exato"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              title={
                t === "parcial"
                  ? "A descrição contém o termo"
                  : "A descrição é exatamente o termo"
              }
              className={clsx(
                "px-2 py-1.5 text-[11px] transition-colors",
                tipo === t
                  ? "bg-accent/12 font-medium text-accent"
                  : "bg-surface text-muted hover:text-ink"
              )}
            >
              {t === "parcial" ? "Contém" : "Exato"}
            </button>
          ))}
        </div>
      </td>
      <td className="py-2 pr-3">
        <ContaDropdown
          empresa={empresa}
          valor={pagamento}
          onMudar={setPagamento}
          placeholder="—"
          limpavel
          largura="w-96"
        />
      </td>
      <td className="py-2 pr-3">
        <ContaDropdown
          empresa={empresa}
          valor={recebimento}
          onMudar={setRecebimento}
          placeholder="—"
          limpavel
          largura="w-96"
        />
      </td>
      <td className="py-2 pl-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {(nova || sujo) && (
            <button
              onClick={salvar}
              disabled={salvando || !podeSalvar}
              title={nova ? "Criar regra" : "Salvar alterações"}
              className="grid size-7 place-items-center rounded-md text-ent hover:bg-accent/12 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {nova ? <Plus className="size-4" /> : <Check className="size-4" />}
            </button>
          )}
          {!nova && (
            <button
              onClick={remover}
              title="Remover regra"
              className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-critical"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
