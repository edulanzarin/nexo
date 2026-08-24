"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { LinkPublico } from "@/components/link-publico";
import { CamposFormulario } from "@/components/formulario-campos";
import { ApuracaoFormulario } from "@/components/apuracao-formulario";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { useClimaDashboard, useFormularios, useRodadasClima } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataBR } from "@/lib/format";
import { decimalBR } from "@/lib/csv";
import {
  MIN_ANONIMATO,
  apurarFormulario,
  filtrarRespostas,
  type Segmento,
} from "@/lib/formularios-apuracao";
import { escalaDoCampo, type FormularioCampo, type RespostaValores } from "@/lib/formularios-tipos";
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
      <Card padding="sm" animate="none">
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
            <Button variant="secondary" onClick={alternarStatus}>
              {rodadaSel.status === "aberta" ? "Fechar rodada" : "Reabrir rodada"}
            </Button>
          )}
          <Button variant="primary" onClick={() => setNovaAberta(true)}>
            <Plus className="size-4" />
            Nova rodada
          </Button>
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
      </Card>

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
        <Resultados dash={dash} />
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

type Aba = "resumo" | "respostas";

/**
 * Resultados da rodada. O RESUMO é a visão padrão: o painel se monta sozinho a
 * partir das perguntas do formulário (ver `ApuracaoFormulario`). A lista de
 * respostas uma a uma continua existindo — vira a segunda aba, para quando se
 * quer ler um envio inteiro em vez do agregado.
 */
function Resultados({ dash }: { dash: ClimaDashboard }) {
  const [aba, setAba] = useState<Aba>("resumo");
  const [segmento, setSegmento] = useState<Segmento | null>(null);

  const valores = useMemo(() => dash.respostas.map((r) => r.valores), [dash.respostas]);
  const filtradas = useMemo(() => filtrarRespostas(valores, segmento), [valores, segmento]);
  // A trava de anonimato vale para a tela E para a exportação: recorte pequeno
  // não vira planilha.
  const travado = segmento != null && filtradas.length < MIN_ANONIMATO;

  const cortes = useMemo<CorteExport[]>(
    () => cortesClima(dash, filtradas, segmento),
    [dash, filtradas, segmento]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-1 border-b border-hairline" aria-label="Resultados">
          {([
            { id: "resumo", rotulo: "Resumo" },
            { id: "respostas", rotulo: `Respostas (${dash.total})` },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              aria-current={aba === t.id ? "page" : undefined}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                aba === t.id
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-muted hover:border-hairline hover:text-ink"
              )}
            >
              {t.rotulo}
            </button>
          ))}
        </nav>
        <div className="ml-auto">
          <ExportarMenu modulo="rh" cortes={cortes} desabilitado={travado} />
        </div>
      </div>

      {aba === "resumo" ? (
        <ApuracaoFormulario
          campos={dash.campos}
          respostas={valores}
          anonimo
          segmento={segmento}
          onSegmento={setSegmento}
        />
      ) : (
        <Respostas dash={dash} />
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
        <Card key={i} padding="md" animate="none">
          <div className="mb-3 flex items-center justify-between text-xs text-muted">
            <span>Resposta {dash.total - i}</span>
            <span>{dataBR(r.criadoEm)}</span>
          </div>
          <CamposFormulario campos={dash.campos} valores={r.valores} somenteLeitura />
        </Card>
      ))}
    </div>
  );
}

/** Valor de um campo como texto de planilha (a escala vira "3 · Bom"). */
function celula(campo: FormularioCampo, valores: RespostaValores): string {
  const v = valores[String(campo.id)];
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.join(" | ");
  if (campo.tipo === "nota" && typeof v === "number") {
    const escala = escalaDoCampo(campo);
    const rotulo = escala[v];
    return rotulo && rotulo !== String(v + 1) ? `${v + 1} · ${rotulo}` : String(v + 1);
  }
  return String(v);
}

/** Os três cortes que uma rodada de clima rende em planilha. */
function cortesClima(
  dash: ClimaDashboard,
  filtradas: RespostaValores[],
  segmento: Segmento | null
): CorteExport[] {
  const sufixo = segmento ? `-recorte` : "";
  const nome = (corte: string) => `clima-${dash.rodada.slug}-${corte}${sufixo}`;
  const apuracoes = apurarFormulario(dash.campos, filtradas);
  // A lista individual precisa da data, que não vive em `valores` — reencontra a
  // resposta original pelo objeto (é o mesmo que o filtro devolveu).
  const dataDe = new Map(dash.respostas.map((r) => [r.valores, r.criadoEm]));

  return [
    {
      id: "respostas",
      rotulo: "Respostas (uma linha por pessoa)",
      descricao: "Uma coluna por pergunta — o formato que abre direto no Excel",
      nome: nome("respostas"),
      montar: () => ({
        cabecalhos: ["Nº", "Enviada em", ...dash.campos.map((c) => c.rotulo)],
        linhas: filtradas.map((valores, i) => [
          i + 1,
          dataBR(dataDe.get(valores) ?? null),
          ...dash.campos.map((c) => celula(c, valores)),
        ]),
      }),
    },
    {
      id: "apuracao",
      rotulo: "Apuração por pergunta",
      descricao: "Cada opção/nível com contagem e percentual, como no resumo",
      nome: nome("apuracao"),
      montar: () => ({
        cabecalhos: ["Pergunta", "Tipo", "Item", "Respostas", "% dos respondentes"],
        linhas: apuracoes.flatMap((a) =>
          a.forma === "texto"
            ? [[a.campo.rotulo, "Texto", "(respostas escritas)", a.respondentes, ""]]
            : a.fatias.map((f) => [
                a.campo.rotulo,
                a.forma === "escala" ? "Escala" : a.forma === "numero" ? "Número" : "Marcação",
                f.rotulo,
                f.n,
                decimalBR(f.pct),
              ])
        ),
      }),
    },
    {
      id: "comentarios",
      rotulo: "Respostas escritas",
      descricao: "Só o que as pessoas escreveram, pergunta a pergunta",
      nome: nome("comentarios"),
      montar: () => ({
        cabecalhos: ["Pergunta", "Resposta"],
        linhas: apuracoes.flatMap((a) =>
          a.forma === "texto" ? a.textos.map((t) => [a.campo.rotulo, t]) : []
        ),
      }),
    },
  ];
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
          <Button variant="secondary" onClick={onFechar} className="px-4">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={criar}
            loading={salvando}
            disabled={ativos.length === 0}
            className="px-4"
          >
            Criar rodada
          </Button>
        </div>
      </div>
    </Modal>
  );
}
