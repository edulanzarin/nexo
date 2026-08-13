"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, IconButton, type BadgeTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CamposFormulario } from "@/components/formulario-campos";
import { EnviarModal, EnviosLista } from "./envios";
import { RegrasLista } from "./regras";
import { mutar } from "@/hooks/mutar";
import { useFormulario, useFormularios } from "@/hooks/use-api";
import { dataBR } from "@/lib/format";
import {
  TIPOS_CAMPO,
  TIPO_CAMPO_ROTULO,
  type CampoConfig,
  type FormularioCampo,
  type FormularioResumo,
  type RespostaValores,
  type StatusFormulario,
  type TipoCampo,
} from "@/lib/formularios-tipos";
import type { CampoEntrada } from "@/lib/formularios";

// ── Draft local do editor (campos editam campos "achatados"; config é montada
//    no salvar). `_key` identifica na UI; `id` é o real (null = campo novo). ────

let seq = 0;
const novaKey = () => `k${++seq}`;
const linhas = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

interface CampoDraft {
  _key: string;
  id: number | null;
  tipo: TipoCampo;
  rotulo: string;
  ajuda: string;
  obrigatorio: boolean;
  opcoesTexto: string; // uma opção por linha (seleção)
  escalaTexto: string; // um rótulo por linha (nota)
  min: number;
  max: number;
}

function campoParaDraft(c: FormularioCampo): CampoDraft {
  return {
    _key: novaKey(),
    id: c.id,
    tipo: c.tipo,
    rotulo: c.rotulo,
    ajuda: c.ajuda ?? "",
    obrigatorio: c.obrigatorio,
    opcoesTexto: (c.config.opcoes ?? []).join("\n"),
    escalaTexto: (c.config.escala ?? []).join("\n"),
    min: c.config.min ?? 0,
    max: c.config.max ?? (c.tipo === "pontuacao" ? 10 : 5),
  };
}

function draftNovo(tipo: TipoCampo): CampoDraft {
  const selec = tipo === "selecao_unica" || tipo === "selecao_multipla";
  return {
    _key: novaKey(),
    id: null,
    tipo,
    rotulo: "",
    ajuda: "",
    obrigatorio: true,
    opcoesTexto: selec ? "Opção 1\nOpção 2" : "",
    escalaTexto: tipo === "nota" ? "Insatisfatório\nRegular\nBom\nExcelente" : "",
    min: 0,
    max: tipo === "pontuacao" ? 10 : 5,
  };
}

function draftConfig(d: CampoDraft): CampoConfig {
  const config: CampoConfig = {};
  if (d.tipo === "selecao_unica" || d.tipo === "selecao_multipla") config.opcoes = linhas(d.opcoesTexto);
  if (d.tipo === "nota") config.escala = linhas(d.escalaTexto);
  if (d.tipo === "pontuacao") {
    config.min = d.min;
    config.max = d.max;
  }
  return config;
}

function draftParaEntrada(d: CampoDraft, ordem: number): CampoEntrada {
  return {
    id: d.id,
    ordem,
    tipo: d.tipo,
    rotulo: d.rotulo,
    ajuda: d.ajuda || null,
    obrigatorio: d.obrigatorio,
    config: draftConfig(d),
  };
}

/** Draft -> campo pleno (com id sintético) para o preview. */
function draftParaCampo(d: CampoDraft, idFake: number): FormularioCampo {
  return {
    id: idFake,
    ordem: idFake,
    tipo: d.tipo,
    rotulo: d.rotulo || "(pergunta sem enunciado)",
    ajuda: d.ajuda || null,
    obrigatorio: d.obrigatorio,
    config: draftConfig(d),
  };
}

const STATUS_ROTULO: Record<StatusFormulario, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  arquivado: "Arquivado",
};
const STATUS_TONE: Record<StatusFormulario, BadgeTone> = {
  rascunho: "neutral",
  ativo: "good",
  arquivado: "neutral",
};

// ── Página ───────────────────────────────────────────────────────────────────

export default function Conteudo() {
  const [abertoId, setAbertoId] = useState<number | null>(null);

  if (abertoId != null) {
    return <Editor key={abertoId} id={abertoId} onVoltar={() => setAbertoId(null)} />;
  }
  return <Lista onEditar={setAbertoId} />;
}

// ── Lista de formulários ──────────────────────────────────────────────────────

function Lista({ onEditar }: { onEditar: (id: number) => void }) {
  const { data, isLoading } = useFormularios();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<"formularios" | "envios" | "automatico">("formularios");
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [enviarForm, setEnviarForm] = useState<{ id: number; nome: string } | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["rh-formularios"] });

  const criar = async () => {
    if (!novoNome.trim()) return toast.error("Dê um nome ao formulário");
    setCriando(true);
    try {
      const f = await mutar<{ id: number }>("/api/rh/formularios", "POST", { nome: novoNome });
      setNovoNome("");
      invalidar();
      onEditar(f.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setCriando(false);
    }
  };

  const duplicar = async (f: FormularioResumo) => {
    try {
      await mutar("/api/rh/formularios", "POST", { duplicarDe: f.id });
      invalidar();
      toast.success("Formulário duplicado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao duplicar");
    }
  };

  const excluir = async (f: FormularioResumo) => {
    if (!confirm(`Excluir o formulário "${f.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await mutar(`/api/rh/formularios?id=${f.id}`, "DELETE");
      invalidar();
      toast.success("Formulário excluído");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
          {(["formularios", "envios", "automatico"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                aba === a ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
              )}
            >
              {a === "formularios" ? "Formulários" : a === "envios" ? "Envios" : "Automático"}
            </button>
          ))}
        </div>
        {aba === "formularios" && (
          <div className="flex items-center gap-2">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criar()}
              placeholder="Nome do novo formulário"
              className="h-9 w-56 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
            />
            <Button variant="primary" onClick={criar} disabled={criando}>
              <Plus className="size-4" /> Criar
            </Button>
          </div>
        )}
      </div>

      {aba === "envios" ? (
        <EnviosLista />
      ) : aba === "automatico" ? (
        <RegrasLista />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<FileText className="size-5" />} titulo="Nenhum formulário ainda." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((f) => (
            <Card key={f.id} padding="sm" animate="none" className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => onEditar(f.id)} className="min-w-0 text-left">
                  <h3 className="truncate font-semibold text-ink hover:underline">{f.nome}</h3>
                  {f.descricao && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{f.descricao}</p>}
                </button>
                <Badge
                  tone={STATUS_TONE[f.status]}
                  size="xs"
                  uppercase
                  className={cn("shrink-0", f.status === "arquivado" && "line-through")}
                >
                  {STATUS_ROTULO[f.status]}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted">
                {f.campos} {f.campos === 1 ? "pergunta" : "perguntas"} · atualizado{" "}
                {dataBR(f.atualizadoEm.slice(0, 10))}
              </p>
              <div className="mt-3 flex items-center gap-1 border-t border-hairline pt-3">
                <Button variant="secondary" size="sm" onClick={() => onEditar(f.id)} className="flex-1">
                  Editar
                </Button>
                {f.status === "ativo" && (
                  <button
                    onClick={() => setEnviarForm({ id: f.id, nome: f.nome })}
                    className="flex items-center gap-1 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ent transition-colors hover:bg-accent/10"
                  >
                    <Send className="size-3.5" /> Enviar
                  </button>
                )}
                <IconButton tone="ghost" size="sm" onClick={() => duplicar(f)} aria-label="Duplicar">
                  <Copy className="size-3.5" />
                </IconButton>
                <IconButton tone="danger" size="sm" onClick={() => excluir(f)} aria-label="Excluir">
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {enviarForm && (
        <EnviarModal
          formularioId={enviarForm.id}
          formularioNome={enviarForm.nome}
          onFechar={() => setEnviarForm(null)}
        />
      )}
    </>
  );
}

// ── Editor de um formulário ───────────────────────────────────────────────────

function Editor({ id, onVoltar }: { id: number; onVoltar: () => void }) {
  const { data, isLoading } = useFormulario(id);
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<StatusFormulario>("rascunho");
  const [campos, setCampos] = useState<CampoDraft[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [preview, setPreview] = useState(false);
  const [valoresPreview, setValoresPreview] = useState<RespostaValores>({});

  // Semeia o estado editável quando a query chega — ajuste de estado no próprio
  // render (padrão recomendado do React), guardado para não repetir/loopar.
  if (data && !seeded) {
    setSeeded(true);
    setNome(data.nome);
    setDescricao(data.descricao ?? "");
    setStatus(data.status);
    setCampos(data.campos.map(campoParaDraft));
  }

  const patch = (key: string, novo: Partial<CampoDraft>) =>
    setCampos((cs) => cs.map((c) => (c._key === key ? { ...c, ...novo } : c)));
  const remover = (key: string) => setCampos((cs) => cs.filter((c) => c._key !== key));
  const mover = (i: number, dir: -1 | 1) =>
    setCampos((cs) => {
      const j = i + dir;
      if (j < 0 || j >= cs.length) return cs;
      const novo = [...cs];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
  const adicionar = (tipo: TipoCampo) => setCampos((cs) => [...cs, draftNovo(tipo)]);

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Dê um nome ao formulário");
    setSalvando(true);
    try {
      await mutar("/api/rh/formularios", "PATCH", {
        id,
        nome,
        descricao,
        status,
        campos: campos.map((c, i) => draftParaEntrada(c, i)),
      });
      queryClient.invalidateQueries({ queryKey: ["rh-formularios"] });
      queryClient.invalidateQueries({ queryKey: ["rh-formulario", id] });
      toast.success("Formulário salvo");
      onVoltar(); // limpa o editor e volta pra lista, mostrando o salvo
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const camposPreview = useMemo(() => campos.map((c, i) => draftParaCampo(c, i)), [campos]);

  if (isLoading && !seeded) {
    return <div className="skeleton h-96 w-full" />;
  }

  return (
    <>
      {/* Barra do editor */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Formulários
        </button>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
            {(["rascunho", "ativo", "arquivado"] as StatusFormulario[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  status === s ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
                )}
              >
                {STATUS_ROTULO[s]}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => setPreview((p) => !p)}
            className={cn(preview && "bg-surface-2 text-ink")}
          >
            <Eye className="size-4" /> {preview ? "Editar" : "Pré-visualizar"}
          </Button>
          <Button variant="primary" onClick={salvar} disabled={salvando}>
            <Save className="size-4" /> {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Meta */}
      <Card padding="sm" animate="none" className="space-y-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do formulário"
          className="w-full border-0 bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-muted"
        />
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          placeholder="Descrição / instruções para quem responde (opcional)"
          className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
        />
      </Card>

      {preview ? (
        <Card padding="none" animate="none" className="px-6 py-5">
          <h2 className="text-lg font-semibold text-ink">{nome || "Formulário"}</h2>
          {descricao && <p className="mt-1 text-sm text-muted">{descricao}</p>}
          <div className="mt-5">
            {camposPreview.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma pergunta ainda.</p>
            ) : (
              <CamposFormulario
                campos={camposPreview}
                valores={valoresPreview}
                onChange={(cid, v) => setValoresPreview((s) => ({ ...s, [String(cid)]: v }))}
              />
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Campos */}
          <div className="space-y-3">
            {campos.map((c, i) => (
              <CampoEditor
                key={c._key}
                campo={c}
                indice={i}
                total={campos.length}
                onMudar={(novo) => patch(c._key, novo)}
                onRemover={() => remover(c._key)}
                onMover={(dir) => mover(i, dir)}
              />
            ))}
          </div>

          {/* Adicionar campo */}
          <Card padding="sm" animate="none">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
              Adicionar pergunta
            </p>
            <div className="flex flex-wrap gap-2">
              {TIPOS_CAMPO.map((t) => (
                <Button key={t} variant="secondary" size="sm" onClick={() => adicionar(t)}>
                  <Plus className="size-3.5" /> {TIPO_CAMPO_ROTULO[t]}
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

// ── Editor de um campo ────────────────────────────────────────────────────────

const CTRL =
  "w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30";

function CampoEditor({
  campo,
  indice,
  total,
  onMudar,
  onRemover,
  onMover,
}: {
  campo: CampoDraft;
  indice: number;
  total: number;
  onMudar: (novo: Partial<CampoDraft>) => void;
  onRemover: () => void;
  onMover: (dir: -1 | 1) => void;
}) {
  const selec = campo.tipo === "selecao_unica" || campo.tipo === "selecao_multipla";
  return (
    <Card padding="sm" animate="none">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex flex-col items-center gap-0.5 text-muted">
          <button
            onClick={() => onMover(-1)}
            disabled={indice === 0}
            className="grid size-6 place-items-center rounded transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            aria-label="Subir"
          >
            <ChevronUp className="size-4" />
          </button>
          <GripVertical className="size-3.5 opacity-40" />
          <button
            onClick={() => onMover(1)}
            disabled={indice === total - 1}
            className="grid size-6 place-items-center rounded transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            aria-label="Descer"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {TIPO_CAMPO_ROTULO[campo.tipo]}
            </span>
          </div>

          <input
            value={campo.rotulo}
            onChange={(e) => onMudar({ rotulo: e.target.value })}
            placeholder="Escreva a pergunta"
            className={clsx(CTRL, "h-9 font-medium")}
          />
          <input
            value={campo.ajuda}
            onChange={(e) => onMudar({ ajuda: e.target.value })}
            placeholder="Texto de ajuda (opcional)"
            className={clsx(CTRL, "h-8 text-xs")}
          />

          {selec && (
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Opções (uma por linha)</span>
              <textarea
                value={campo.opcoesTexto}
                onChange={(e) => onMudar({ opcoesTexto: e.target.value })}
                rows={Math.max(2, campo.opcoesTexto.split("\n").length)}
                className={clsx(CTRL, "py-2")}
              />
            </label>
          )}

          {campo.tipo === "nota" && (
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Níveis da escala (um por linha)</span>
              <textarea
                value={campo.escalaTexto}
                onChange={(e) => onMudar({ escalaTexto: e.target.value })}
                rows={Math.max(2, campo.escalaTexto.split("\n").length)}
                className={clsx(CTRL, "py-2")}
              />
            </label>
          )}

          {campo.tipo === "pontuacao" && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted">
                Mínimo{" "}
                <input
                  type="number"
                  value={campo.min}
                  onChange={(e) => onMudar({ min: Number(e.target.value) })}
                  className={clsx(CTRL, "mt-1 h-8 w-24")}
                />
              </label>
              <label className="text-xs text-muted">
                Máximo{" "}
                <input
                  type="number"
                  value={campo.max}
                  onChange={(e) => onMudar({ max: Number(e.target.value) })}
                  className={clsx(CTRL, "mt-1 h-8 w-24")}
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs text-ink-2">
              <input
                type="checkbox"
                checked={campo.obrigatorio}
                onChange={(e) => onMudar({ obrigatorio: e.target.checked })}
                className="size-3.5 accent-ink"
              />
              Obrigatória
            </label>
          </div>
        </div>

        <IconButton tone="danger" size="sm" onClick={onRemover} aria-label="Remover pergunta">
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </Card>
  );
}
