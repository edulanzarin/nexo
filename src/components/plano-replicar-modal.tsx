"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { ListaModal } from "@/components/lista-modal";
import { ComboCriavel } from "@/components/ui/combo-criavel";
import { useEmpresas, useReplicarPreview } from "@/hooks/use-api";
import { num } from "@/lib/format";
import type { ReplicarItem, ReplicarResp } from "@/lib/types";

/**
 * Replicar os overrides do plano da empresa ABERTA (origem) para outra empresa:
 * escolhe o destino, marca todos ou só alguns CFOPs e replica. Override com
 * conta que não existe no plano de contas do destino fica bloqueado (replicar
 * cobraria uma conta inexistente lá). Monta sobre a base comum `ListaModal`.
 */
export function ReplicarModal({
  origem,
  aberto,
  onFechar,
  onReplicado,
}: {
  origem: number;
  aberto: boolean;
  onFechar: () => void;
  onReplicado: () => void;
}) {
  const [destino, setDestino] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  // CFOPs DESMARCADOS (começa tudo marcado — o caso comum é replicar tudo).
  const [desmarcados, setDesmarcados] = useState<Set<number>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const { data: empresas } = useEmpresas();
  const origemNome = empresas?.find((e) => e.codigo === origem)?.nome ?? `empresa ${origem}`;
  const preview = useReplicarPreview(aberto ? origem : null, destino);
  const itens = useMemo(() => preview.data?.itens ?? [], [preview.data]);

  const q = busca.trim().toLowerCase();
  const visiveis = !q
    ? itens
    : itens.filter(
        (i) => String(i.cfop).includes(q) || (i.descricao ?? "").toLowerCase().includes(q)
      );

  const replicaveis = itens.filter((i) => !i.contasAusentes.length);
  const escolhidos = replicaveis.filter((i) => !desmarcados.has(i.cfop));

  function alternar(cfop: number) {
    setDesmarcados((s) => {
      const n = new Set(s);
      if (n.has(cfop)) n.delete(cfop);
      else n.add(cfop);
      return n;
    });
  }

  async function replicar() {
    if (destino == null || !escolhidos.length) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/contabil/plano/replicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origem, destino, cfops: escolhidos.map((i) => i.cfop) }),
      });
      const corpo = (await r.json()) as ReplicarResp & { error?: string };
      if (!r.ok) throw new Error(corpo.error ?? "Falha ao replicar");
      toast.success(
        `${num(corpo.replicados)} ${corpo.replicados === 1 ? "override replicado" : "overrides replicados"}` +
          (corpo.pulados.length ? ` · ${num(corpo.pulados.length)} pulados` : "")
      );
      onReplicado();
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao replicar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ListaModal
      aberto={aberto}
      onFechar={onFechar}
      largura="max-w-4xl"
      ariaLabel="Replicar overrides"
      titulo={<h3 className="text-lg font-semibold">Replicar overrides</h3>}
      subtitulo={`De ${origemNome} para a empresa escolhida`}
      busca={busca}
      onBusca={setBusca}
      buscaPlaceholder="CFOP ou descrição…"
      carregando={preview.isLoading}
      rodape={
        <>
          <span>
            {destino == null
              ? "Escolha a empresa de destino"
              : `${num(escolhidos.length)} de ${num(replicaveis.length)} ${replicaveis.length === 1 ? "selecionado" : "selecionados"}`}
          </span>
          <button
            onClick={replicar}
            disabled={destino == null || !escolhidos.length || enviando}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
          >
            {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
            {enviando ? "Replicando…" : "Replicar"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-6 py-3">
        <label className="text-xs text-muted" htmlFor="replicar-destino">
          Destino
        </label>
        <div className="w-72">
          <ComboCriavel
            name="replicar-destino"
            criavel={false}
            opcoes={(empresas ?? [])
              .filter((e) => e.codigo !== origem)
              .map((e) => ({ id: e.codigo, nome: `${e.codigo} · ${e.nome}` }))}
            placeholder="Escolher empresa…"
            onChange={(sel) => {
              setDestino(sel ? sel.id : null);
              setDesmarcados(new Set());
            }}
          />
        </div>
        {destino != null && replicaveis.length > 0 && (
          <button
            onClick={() =>
              setDesmarcados(
                escolhidos.length === replicaveis.length
                  ? new Set(replicaveis.map((i) => i.cfop))
                  : new Set()
              )
            }
            className="text-xs text-accent hover:underline"
          >
            {escolhidos.length === replicaveis.length ? "Desmarcar todos" : "Marcar todos"}
          </button>
        )}
      </div>

      {destino == null ? (
        <p className="grid h-40 place-items-center text-sm text-muted">
          Escolha a empresa de destino.
        </p>
      ) : preview.isLoading ? (
        <div className="p-6">
          <div className="skeleton h-40 w-full" />
        </div>
      ) : visiveis.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">
          {itens.length === 0 ? "Esta empresa não tem override para replicar." : "Nenhum CFOP com esse filtro."}
        </p>
      ) : (
        <table className="w-full min-w-[680px] text-xs">
          <thead className="sticky top-0 bg-surface text-left text-muted">
            <tr className="border-b border-hairline">
              <th className="w-10 py-2 pl-6" />
              <th className="py-2 pr-3 font-medium">CFOP</th>
              <th className="py-2 pr-3 font-medium">Descrição</th>
              <th className="py-2 pr-6 font-medium">Lançamentos</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i) => (
              <LinhaItem
                key={i.cfop}
                item={i}
                marcado={!i.contasAusentes.length && !desmarcados.has(i.cfop)}
                onAlternar={() => alternar(i.cfop)}
              />
            ))}
          </tbody>
        </table>
      )}
    </ListaModal>
  );
}

function LinhaItem({
  item,
  marcado,
  onAlternar,
}: {
  item: ReplicarItem;
  marcado: boolean;
  onAlternar: () => void;
}) {
  const bloqueado = item.contasAusentes.length > 0;
  return (
    <tr
      className={clsx(
        "border-b border-hairline/50 last:border-0",
        bloqueado ? "opacity-50" : "cursor-pointer hover:bg-surface-2/50"
      )}
      onClick={bloqueado ? undefined : onAlternar}
    >
      <td className="py-2 pl-6">
        <input
          type="checkbox"
          checked={marcado}
          disabled={bloqueado}
          onChange={onAlternar}
          onClick={(e) => e.stopPropagation()}
          className="accent-ent"
          aria-label={`Replicar CFOP ${item.cfop}`}
        />
      </td>
      <td className="py-2 pr-3 tabular-nums text-ink">{item.cfop}</td>
      <td className="max-w-[240px] py-2 pr-3">
        <span className="block truncate text-ink-2" title={item.descricao ?? ""}>
          {item.descricao ?? "—"}
        </span>
        {bloqueado ? (
          <span
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-critical"
            title={`Estas contas não existem no plano de contas do destino: ${item.contasAusentes.join(", ")}`}
          >
            <AlertTriangle className="size-3" /> conta {item.contasAusentes.join(", ")} não existe no destino
          </span>
        ) : (
          item.jaExiste && (
            <span
              className="mt-0.5 inline-block rounded bg-warn/12 px-1.5 py-0.5 text-[10px] font-medium text-warn"
              title="O destino já tem override para este CFOP — replicar substitui"
            >
              substitui existente
            </span>
          )
        )}
      </td>
      <td className="py-2 pr-6">
        {!item.contabiliza ? (
          <span className="text-muted">não contabiliza</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {item.linhas.map((l, k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">
                <span className={clsx("font-semibold", l.natureza === 1 ? "text-ent" : "text-sai")}>
                  {l.natureza === 1 ? "D" : "C"}
                </span>
                <span className="tabular-nums text-ink">{l.contaVariavel ? "variável" : l.conta}</span>
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
