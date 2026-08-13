"use client";

import clsx from "clsx";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { LinkPublico } from "@/components/link-publico";
import { CamposFormulario } from "@/components/formulario-campos";
import { useClimaDashboard, useFormularios, useRodadasClima } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataBR } from "@/lib/format";
import type { ClimaDashboard } from "@/lib/clima-tipos";

const CAMPO = "h-9 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30";

export default function Conteudo() {
  const { data: rodadasData, isLoading: carregandoRodadas } = useRodadasClima();
  const rodadas = rodadasData?.rodadas ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const selId = sel ?? rodadas[0]?.id ?? null;
  const rodadaSel = rodadas.find((r) => r.id === selId) ?? null;

  const { data: dash, isLoading: carregandoDash } = useClimaDashboard(selId);
  const [novaAberta, setNovaAberta] = useState(false);
  const qc = useQueryClient();

  const alternarStatus = async () => {
    if (!rodadaSel) return;
    const novo = rodadaSel.status === "aberta" ? "fechada" : "aberta";
    try {
      await mutar("/api/rh/clima", "PATCH", { id: rodadaSel.id, status: novo });
      qc.invalidateQueries({ queryKey: ["rh-clima-rodadas"] });
      qc.invalidateQueries({ queryKey: ["rh-clima", rodadaSel.id] });
      toast.success(novo === "aberta" ? "Rodada reaberta" : "Rodada fechada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de rodada: seletor + status + nova */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selId ?? ""}
            onChange={(e) => setSel(Number(e.target.value))}
            className={clsx(CAMPO, "min-w-52 flex-1")}
            disabled={carregandoRodadas || rodadas.length === 0}
          >
            {rodadas.length === 0 && <option value="">Nenhuma rodada</option>}
            {rodadas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.titulo} · {r.respostas} {r.respostas === 1 ? "resposta" : "respostas"}
                {r.status === "fechada" ? " (fechada)" : ""}
              </option>
            ))}
          </select>

          {rodadaSel && (
            <button
              onClick={alternarStatus}
              className="flex h-9 items-center rounded-lg border border-hairline px-3 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {rodadaSel.status === "aberta" ? "Fechar rodada" : "Reabrir rodada"}
            </button>
          )}
          <button
            onClick={() => setNovaAberta(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-medium text-surface transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            Nova rodada
          </button>
        </div>

        {rodadaSel && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted">
              {rodadaSel.status === "aberta"
                ? "Link público desta rodada (divulgue no comunicado interno / intranet):"
                : "Rodada fechada — o link não aceita novas respostas."}
            </p>
            <LinkPublico caminho={`/clima/${rodadaSel.slug}`} />
          </div>
        )}
      </div>

      {carregandoDash || !dash ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      ) : dash.total === 0 ? (
        <p className="card px-6 py-16 text-center text-sm text-muted">
          Ainda sem respostas nesta rodada.
        </p>
      ) : (
        <Respostas dash={dash} />
      )}

      {novaAberta && (
        <NovaRodadaModal
          onFechar={() => setNovaAberta(false)}
          onCriada={(id) => {
            setSel(id);
            setNovaAberta(false);
          }}
        />
      )}
    </div>
  );
}

function Respostas({ dash }: { dash: ClimaDashboard }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        <span className="font-semibold text-ink">{dash.total}</span>{" "}
        {dash.total === 1 ? "resposta anônima" : "respostas anônimas"}
      </p>
      {dash.respostas.map((r, i) => (
        <div key={i} className="card p-5">
          <div className="mb-3 flex items-center justify-between text-xs text-muted">
            <span>Resposta {dash.total - i}</span>
            <span>{dataBR(r.criadoEm)}</span>
          </div>
          <CamposFormulario campos={dash.campos} valores={r.valores} somenteLeitura />
        </div>
      ))}
    </div>
  );
}

function NovaRodadaModal({ onFechar, onCriada }: { onFechar: () => void; onCriada: (id: number) => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [formularioId, setFormularioId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const qc = useQueryClient();

  const { data: formularios } = useFormularios();
  const ativos = (formularios ?? []).filter((f) => f.status === "ativo" && f.campos > 0);

  const criar = async () => {
    if (!titulo.trim()) return toast.error("Dê um título à rodada");
    if (!formularioId) return toast.error("Escolha um formulário");
    setSalvando(true);
    try {
      const r = await mutar<{ id: number; slug: string }>("/api/rh/clima", "POST", {
        titulo,
        descricao: descricao || null,
        formularioId,
      });
      qc.invalidateQueries({ queryKey: ["rh-clima-rodadas"] });
      toast.success("Rodada criada");
      onCriada(r.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto onFechar={onFechar} titulo="Nova rodada de avaliação" largura="max-w-lg">
      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Título *</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={clsx(CAMPO, "w-full")}
            placeholder="Ex.: Avaliação da empresa — 2º semestre 2026"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Formulário *</span>
          <select
            value={formularioId ?? ""}
            onChange={(e) => setFormularioId(e.target.value ? Number(e.target.value) : null)}
            className={clsx(CAMPO, "w-full")}
            disabled={ativos.length === 0}
          >
            <option value="">Escolha um formulário…</option>
            {ativos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} · {f.campos} {f.campos === 1 ? "pergunta" : "perguntas"}
              </option>
            ))}
          </select>
          {ativos.length === 0 ? (
            <p className="mt-1 text-xs text-warning">
              Nenhum formulário ativo. Monte um em Formulários e marque como ativo para usar aqui.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              As perguntas do formulário escolhido são o que o funcionário responde — anonimamente.
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Descrição (opcional)</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
            placeholder="Texto que aparece no topo do formulário público."
          />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onFechar} className="h-9 rounded-lg border border-hairline px-4 text-sm text-ink-2 hover:text-ink">
            Cancelar
          </button>
          <button
            onClick={criar}
            disabled={salvando || ativos.length === 0}
            className="flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando && <Loader2 className="size-4 animate-spin" />}
            Criar rodada
          </button>
        </div>
      </div>
    </Modal>
  );
}
