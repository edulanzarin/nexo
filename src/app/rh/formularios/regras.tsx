"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  AlarmClock,
  CalendarClock,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { mutar } from "@/hooks/mutar";
import { useEnvioRegras, useFormularios, useRhFuncionarios, useRhSetores } from "@/hooks/use-api";
import { dataBR } from "@/lib/format";
import type { EnvioRegra } from "@/lib/envio-regras";

type Destinatario = "gestores" | "colaboradores";
type Escopo = "generico" | "sobre_colaborador";
type AlvoTipo = "todos" | "setores" | "colaboradores";
type FreqTipo = "dias" | "mensal";

function rotuloDestino(r: EnvioRegra): string {
  if (r.destinatarioTipo === "colaboradores") return "Colaboradores";
  return r.escopo === "sobre_colaborador" ? "Gestores · sobre colaborador" : "Gestores";
}

function rotuloAlvo(r: EnvioRegra): string {
  if (r.alvoTipo === "todos") return "Todos";
  const n = Array.isArray(r.alvo) ? r.alvo.length : 0;
  return r.alvoTipo === "setores"
    ? `${n} setor${n === 1 ? "" : "es"}`
    : `${n} colaborador${n === 1 ? "" : "es"}`;
}

function rotuloFreq(r: EnvioRegra): string {
  return r.freqTipo === "dias" ? `a cada ${r.freqValor} dia(s)` : `todo dia ${r.freqValor}`;
}

// ── Lista de regras ───────────────────────────────────────────────────────────

export function RegrasLista() {
  const { data, isLoading } = useEnvioRegras();
  const queryClient = useQueryClient();
  const [editar, setEditar] = useState<EnvioRegra | "nova" | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["rh-envio-regras"] });

  const excluir = async (r: EnvioRegra) => {
    if (!confirm(`Excluir a regra de "${r.formularioNome}"? Os envios já feitos permanecem.`)) return;
    try {
      await mutar(`/api/rh/envio-regras?id=${r.id}`, "DELETE");
      invalidar();
      toast.success("Regra excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-3">
        <button
          onClick={() => setEditar("nova")}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-medium text-surface transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" /> Nova regra
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="card grid place-items-center gap-2 py-16 text-center text-muted">
          <AlarmClock className="size-8 opacity-40" />
          <p>Nenhuma regra automática.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-surface">
                <tr className="border-b border-hairline text-xs text-muted">
                  <th className="py-2 pl-4 pr-3 text-left font-medium">Formulário</th>
                  <th className="py-2 px-3 text-left font-medium">Quem responde</th>
                  <th className="py-2 px-3 text-left font-medium">Alvo</th>
                  <th className="py-2 px-3 text-left font-medium">Frequência</th>
                  <th className="py-2 px-3 text-left font-medium">Próximo</th>
                  <th className="py-2 pl-3 pr-4 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-hairline/60 last:border-0">
                    <td className="py-3 pl-4 pr-3">
                      <span className="font-medium text-ink">{r.formularioNome}</span>
                      {!r.ativo && (
                        <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                          pausada
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-ink-2">{rotuloDestino(r)}</td>
                    <td className="py-3 px-3 text-ink-2">{rotuloAlvo(r)}</td>
                    <td className="py-3 px-3 text-ink-2">{rotuloFreq(r)}</td>
                    <td className="py-3 px-3 text-ink-2 tabular-nums">
                      {r.ativo ? dataBR(r.proximoDisparo.slice(0, 10)) : "—"}
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditar(r)}
                          className="grid size-8 place-items-center rounded-lg border border-hairline text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                          title="Editar regra"
                          aria-label="Editar regra"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => excluir(r)}
                          className="grid size-8 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:bg-critical/12 hover:text-critical"
                          title="Excluir regra"
                          aria-label="Excluir regra"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editar != null && (
        <RegraModal regra={editar === "nova" ? null : editar} onFechar={() => setEditar(null)} />
      )}
    </>
  );
}

// ── Modal: criar/editar regra ─────────────────────────────────────────────────

function RegraModal({ regra, onFechar }: { regra: EnvioRegra | null; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const { data: formularios } = useFormularios();
  const { data: setores } = useRhSetores();

  const [formularioId, setFormularioId] = useState<number | "">(regra?.formularioId ?? "");
  const [destinatario, setDestinatario] = useState<Destinatario>(regra?.destinatarioTipo ?? "gestores");
  const [escopo, setEscopo] = useState<Escopo>(regra?.escopo ?? "generico");
  const [alvoTipo, setAlvoTipo] = useState<AlvoTipo>(regra?.alvoTipo ?? "todos");
  const [selecSetores, setSelecSetores] = useState<Set<string>>(
    () => new Set(regra?.alvoTipo === "setores" ? (regra.alvo as string[]) : [])
  );
  const [selecColab, setSelecColab] = useState<Set<string>>(
    () =>
      new Set(
        regra?.alvoTipo === "colaboradores"
          ? (regra.alvo as { empresa: number; contrato: number }[]).map((c) => `${c.empresa}:${c.contrato}`)
          : []
      )
  );
  const [buscaColab, setBuscaColab] = useState("");
  const [freqTipo, setFreqTipo] = useState<FreqTipo>(regra?.freqTipo ?? "mensal");
  const [freqValor, setFreqValor] = useState<number>(regra?.freqValor ?? 1);
  const [titulo, setTitulo] = useState(regra?.titulo ?? "");
  const [mensagem, setMensagem] = useState(regra?.mensagem ?? "");
  const [ativo, setAtivo] = useState(regra?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  const sobreColaborador = destinatario === "gestores" && escopo === "sobre_colaborador";
  const { data: funcionarios } = useRhFuncionarios(alvoTipo === "colaboradores");
  const formsAtivos = useMemo(
    () => (formularios ?? []).filter((f) => f.status === "ativo"),
    [formularios]
  );

  const colabKey = (empresa: number, contrato: number) => `${empresa}:${contrato}`;
  const colabFiltrados = useMemo(() => {
    const q = buscaColab.trim().toLowerCase();
    const todos = funcionarios ?? [];
    if (!q) return todos;
    return todos.filter((f) => [f.nome, f.setor, f.cargo].some((v) => v?.toLowerCase().includes(q)));
  }, [funcionarios, buscaColab]);

  const alternarSetor = (c: string) =>
    setSelecSetores((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  const alternarColab = (empresa: number, contrato: number) =>
    setSelecColab((s) => {
      const k = colabKey(empresa, contrato);
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const salvar = async () => {
    if (!formularioId) return toast.error("Escolha um formulário");
    if (alvoTipo === "setores" && selecSetores.size === 0) return toast.error("Selecione ao menos um setor");
    if (alvoTipo === "colaboradores" && selecColab.size === 0)
      return toast.error("Selecione ao menos um colaborador");
    if (freqTipo === "dias" && freqValor < 1) return toast.error("A cada quantos dias? (mínimo 1)");
    if (freqTipo === "mensal" && (freqValor < 1 || freqValor > 28))
      return toast.error("O dia do mês deve estar entre 1 e 28");

    const alvo =
      alvoTipo === "setores"
        ? [...selecSetores]
        : alvoTipo === "colaboradores"
          ? [...selecColab].map((k) => {
              const [empresa, contrato] = k.split(":").map(Number);
              return { empresa, contrato };
            })
          : [];

    const corpo = {
      formularioId: Number(formularioId),
      titulo: titulo || null,
      mensagem: mensagem || null,
      destinatarioTipo: destinatario,
      escopo,
      alvoTipo,
      alvo,
      freqTipo,
      freqValor,
      ativo,
    };

    setSalvando(true);
    try {
      if (regra) await mutar(`/api/rh/envio-regras?id=${regra.id}`, "PUT", corpo);
      else await mutar("/api/rh/envio-regras", "POST", corpo);
      queryClient.invalidateQueries({ queryKey: ["rh-envio-regras"] });
      toast.success(regra ? "Regra atualizada" : "Regra criada");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const INPUT =
    "h-9 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30";

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={regra ? "Editar regra automática" : "Nova regra automática"}
      largura="max-w-xl"
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Formulário</span>
          <select
            value={formularioId}
            onChange={(e) => setFormularioId(e.target.value ? Number(e.target.value) : "")}
            className={INPUT}
          >
            <option value="">— escolha —</option>
            {formsAtivos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          {formsAtivos.length === 0 && (
            <span className="mt-1 block text-[11px] text-warning">
              Nenhum formulário ativo.
            </span>
          )}
        </label>

        {/* Quem responde */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Quem responde</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline p-1">
            {(
              [
                { v: "gestores", rot: "Gestores", Icone: Users },
                { v: "colaboradores", rot: "Colaboradores", Icone: User },
              ] as const
            ).map(({ v, rot, Icone }) => (
              <button
                key={v}
                onClick={() => setDestinatario(v)}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  destinatario === v ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2"
                )}
              >
                <Icone className="size-4" /> {rot}
              </button>
            ))}
          </div>
        </div>

        {destinatario === "gestores" && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Sobre quem é</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline p-1">
              {(
                [
                  { v: "generico", rot: "Genérico" },
                  { v: "sobre_colaborador", rot: "Um colaborador" },
                ] as const
              ).map(({ v, rot }) => (
                <button
                  key={v}
                  onClick={() => setEscopo(v)}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    escopo === v ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2"
                  )}
                >
                  {rot}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Alvo */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">
            {sobreColaborador || destinatario === "colaboradores"
              ? "Quais colaboradores"
              : "Quais setores"}
          </span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-hairline p-1">
            {(
              [
                { v: "todos", rot: "Todos" },
                { v: "setores", rot: "Por setor" },
                { v: "colaboradores", rot: "Escolher" },
              ] as const
            ).map(({ v, rot }) => (
              <button
                key={v}
                onClick={() => setAlvoTipo(v)}
                className={clsx(
                  "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  alvoTipo === v ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2"
                )}
              >
                {rot}
              </button>
            ))}
          </div>
        </div>

        {alvoTipo === "setores" && (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-hairline p-1.5">
            {(setores ?? []).map((s) => (
              <label
                key={s.classiforgan}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={selecSetores.has(s.classiforgan)}
                  onChange={() => alternarSetor(s.classiforgan)}
                  className="size-3.5 accent-ink"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.nome}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{s.ativos}</span>
              </label>
            ))}
          </div>
        )}

        {alvoTipo === "colaboradores" && (
          <div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={buscaColab}
                onChange={(e) => setBuscaColab(e.target.value)}
                placeholder="Buscar por nome, setor ou cargo"
                className="h-9 w-full rounded-lg border border-hairline bg-surface pl-8 pr-3 text-sm outline-none focus:border-ink/30"
              />
            </div>
            {!funcionarios ? (
              <div className="skeleton h-40 rounded-lg" />
            ) : (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-hairline p-1.5">
                {colabFiltrados.map((f) => (
                  <label
                    key={colabKey(f.codigoempresa, f.contrato)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={selecColab.has(colabKey(f.codigoempresa, f.contrato))}
                      onChange={() => alternarColab(f.codigoempresa, f.contrato)}
                      className="size-3.5 accent-ink"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.nome}</span>
                    <span className="shrink-0 truncate text-xs text-muted">{f.setor ?? "—"}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Frequência */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Frequência</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={freqTipo}
              onChange={(e) => setFreqTipo(e.target.value as FreqTipo)}
              className="h-9 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
            >
              <option value="mensal">Mensal, no dia</option>
              <option value="dias">A cada N dias</option>
            </select>
            <input
              type="number"
              min={1}
              max={freqTipo === "mensal" ? 28 : undefined}
              value={freqValor}
              onChange={(e) => setFreqValor(Number(e.target.value))}
              className="h-9 w-24 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
            />
            <span className="text-xs text-muted">{freqTipo === "mensal" ? "(dia do mês, 1–28)" : "dia(s)"}</span>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Assunto (opcional)</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Default: nome do formulário"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Mensagem (opcional)</span>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
            placeholder="Texto que acompanha o link no e-mail"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="size-3.5 accent-ink"
          />
          Regra ativa (desmarque para pausar sem excluir)
        </label>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-3">
        <button
          onClick={onFechar}
          className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
          {salvando ? "Salvando…" : regra ? "Salvar" : "Criar regra"}
        </button>
      </footer>
    </Modal>
  );
}
