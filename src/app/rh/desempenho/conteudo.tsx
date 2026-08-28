"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, IconButton, type BadgeTone } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { CamposFormulario } from "@/components/formulario-campos";
import { SeloEmpresa } from "@/components/rh-selo-empresa";
import {
  useDesempenho,
  useDesempenhoDetalhe,
  useDesempenhoRodadas,
  useFormularios,
  useRhFuncionarios,
  useRhGestores,
  useRhSetores,
} from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataBR, dataHoraBR } from "@/lib/format";
import { EMPRESAS_RH, nomeEmpresaRh } from "@/lib/rh";
import {
  STATUS_DESEMPENHO,
  STATUS_DESEMPENHO_ROTULO,
  type StatusDesempenho,
} from "@/lib/rh-desempenho";
import type { DesempenhoItem } from "@/lib/rh-tipos";
import type { RespostaValores } from "@/lib/formularios-tipos";

/**
 * Avaliação de desempenho: a RH escolhe um formulário e dispara sobre um ou
 * vários colaboradores (até o escritório inteiro). Cada avaliação vai aos
 * gestores do setor da pessoa e aceita VÁRIAS respostas — uma por gestor.
 *
 * A tela é a lista filtrável dessas avaliações: a mesma pessoa aparece uma vez
 * por rodada, e é isso que forma o histórico dela.
 */

const CAMPO =
  "h-9 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-ink/30";

const STATUS_TONE: Record<StatusDesempenho, BadgeTone> = {
  pendente: "neutral",
  enviado: "warning",
  respondido: "good",
  erro: "critical",
};

// ── Modal: nova rodada de avaliação ───────────────────────────────────────────

type Modo = "escolher" | "escritorio";

function NovaAvaliacaoModal({ onFechar }: { onFechar: () => void }) {
  const { data: formularios } = useFormularios();
  const { data: funcionarios } = useRhFuncionarios();
  const { data: gestores } = useRhGestores();
  const { data: setores } = useRhSetores();
  const queryClient = useQueryClient();

  const ativos = useMemo(
    () => (formularios ?? []).filter((f) => f.status === "ativo"),
    [formularios]
  );
  const [formularioId, setFormularioId] = useState<number | "">("");
  const [modo, setModo] = useState<Modo>("escolher");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busca, setBusca] = useState("");
  const [selec, setSelec] = useState<Set<string>>(new Set());
  const [empresa, setEmpresa] = useState<number | "">("");
  const [setor, setSetor] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Departamento sem gestor cadastrado não tem para quem mandar — a pessoa fica
  // de fora e a tela diz isso antes do disparo, não depois.
  const deptComGestor = useMemo(
    () => new Set((gestores ?? []).filter((g) => g.ativo).map((g) => g.classiforgan)),
    [gestores]
  );
  const semGestor = (f: { classiforgan: string | null }) =>
    f.classiforgan == null || !deptComGestor.has(f.classiforgan);

  const chave = (empresaCod: number, contrato: number) => `${empresaCod}:${contrato}`;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const todos = funcionarios ?? [];
    if (!q) return todos;
    return todos.filter((f) =>
      [f.nome, f.setor, f.cargo].some((v) => v?.toLowerCase().includes(q))
    );
  }, [funcionarios, busca]);

  const chavesFiltradas = useMemo(
    () => lista.map((f) => chave(f.codigoempresa, f.contrato)),
    [lista]
  );
  const todosMarcados =
    chavesFiltradas.length > 0 && chavesFiltradas.every((k) => selec.has(k));

  const alternar = (k: string) =>
    setSelec((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const marcarTodos = () =>
    setSelec((s) => {
      const n = new Set(s);
      if (todosMarcados) for (const k of chavesFiltradas) n.delete(k);
      else for (const k of chavesFiltradas) n.add(k);
      return n;
    });

  // O que de fato vai virar avaliação em cada modo (já sem quem não tem gestor).
  const alvo = useMemo(() => {
    const todos = funcionarios ?? [];
    const escolhidos =
      modo === "escolher"
        ? todos.filter((f) => selec.has(chave(f.codigoempresa, f.contrato)))
        : todos
            .filter((f) => (empresa === "" ? true : f.codigoempresa === empresa))
            .filter((f) => (setor ? f.classiforgan === setor : true));
    return {
      validos: escolhidos.filter((f) => !semGestor(f)),
      ignorados: escolhidos.filter(semGestor).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarios, modo, selec, empresa, setor, deptComGestor]);

  const enviar = async () => {
    if (!formularioId) return toast.error("Escolha um formulário");
    if (!alvo.validos.length) {
      return toast.error(
        alvo.ignorados
          ? "Nenhum colaborador do recorte tem gestor cadastrado no departamento"
          : "Selecione ao menos um colaborador"
      );
    }
    setEnviando(true);
    try {
      const corpo: Record<string, unknown> = {
        formularioId,
        titulo: titulo.trim() || null,
        mensagem: mensagem.trim() || null,
      };
      if (modo === "escritorio") {
        corpo.escritorio = true;
        if (empresa !== "") corpo.empresa = empresa;
        if (setor) corpo.setor = setor;
      } else {
        corpo.colaboradores = alvo.validos.map((f) => ({
          codigoempresa: f.codigoempresa,
          codigofunccontr: f.contrato,
          nome: f.nome,
          classiforgan: f.classiforgan,
        }));
      }
      const r = await mutar<{ avaliacoes: number; semGestor: string[] }>(
        "/api/rh/desempenho",
        "POST",
        corpo
      );
      queryClient.invalidateQueries({ queryKey: ["rh-desempenho"] });
      queryClient.invalidateQueries({ queryKey: ["rh-desempenho-rodadas"] });
      toast.success(
        `${r.avaliacoes} avaliação(ões) enviada(s) aos gestores dos setores`
      );
      if (r.semGestor?.length) {
        toast.warning(`${r.semGestor.length} sem gestor no departamento — ficaram de fora`);
      }
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Nova avaliação de desempenho"
      largura="max-w-xl"
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Formulário</span>
          <select
            value={formularioId}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : "";
              setFormularioId(id);
              const f = ativos.find((x) => x.id === id);
              if (f && !titulo.trim()) setTitulo(f.nome);
            }}
            className={`${CAMPO} w-full`}
          >
            <option value="">Escolha um formulário ativo</option>
            {ativos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          {ativos.length === 0 && (
            <span className="mt-1 block text-xs text-warning">
              Nenhum formulário ativo — monte um em Formulários.
            </span>
          )}
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Sobre quem</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline p-1">
            {(
              [
                { v: "escolher", rot: "Escolher colaboradores" },
                { v: "escritorio", rot: "Escritório inteiro" },
              ] as const
            ).map(({ v, rot }) => (
              <button
                key={v}
                onClick={() => setModo(v)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  modo === v ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2"
                )}
              >
                {rot}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Cada colaborador vira uma avaliação enviada aos gestores do setor dele. Todos os
            gestores recebem o mesmo link e cada um responde a sua.
          </p>
        </div>

        {modo === "escritorio" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-2">Empresa</span>
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value ? Number(e.target.value) : "")}
                className={`${CAMPO} w-full`}
              >
                <option value="">Todas</option>
                {EMPRESAS_RH.map((c) => (
                  <option key={c} value={c}>
                    {nomeEmpresaRh(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-2">Setor</span>
              <select
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className={`${CAMPO} w-full`}
              >
                <option value="">Todos</option>
                {(setores ?? []).map((s) => (
                  <option key={s.classiforgan} value={s.classiforgan}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-2">Colaboradores</span>
              {chavesFiltradas.length > 0 && (
                <Button variant="link" onClick={marcarTodos} className="text-xs">
                  {todosMarcados ? "Limpar" : "Selecionar todos"}
                </Button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, setor ou cargo"
                className={`${CAMPO} w-full pl-8`}
              />
            </div>
            {!funcionarios ? (
              <div className="skeleton h-44 rounded-lg" />
            ) : lista.length === 0 ? (
              <p className="rounded-lg border border-hairline px-3 py-2 text-xs text-muted">
                Nenhum colaborador encontrado.
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-hairline p-1.5">
                {lista.map((f) => {
                  const k = chave(f.codigoempresa, f.contrato);
                  return (
                    <label
                      key={k}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={selec.has(k)}
                        onChange={() => alternar(k)}
                        className="size-3.5 accent-ink"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.nome}</span>
                      {semGestor(f) ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-warning">
                          <AlertTriangle className="size-3" /> sem gestor
                        </span>
                      ) : (
                        <span className="shrink-0 truncate text-xs text-muted">
                          {f.setor ?? "—"}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Assunto do e-mail</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Padrão: o nome do formulário"
            className={`${CAMPO} w-full`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Mensagem (opcional)</span>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={2}
            placeholder="Texto que acompanha o link no e-mail"
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
          />
        </label>

        {alvo.ignorados > 0 && (
          <p className="flex items-center gap-1 text-[11px] text-warning">
            <AlertTriangle className="size-3" />
            {alvo.ignorados} colaborador(es) sem gestor no departamento ficam de fora.
          </p>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-3">
        <span className="text-xs text-muted">{alvo.validos.length} avaliação(ões)</span>
        <Button variant="primary" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {enviando ? "Enviando…" : "Enviar agora"}
        </Button>
      </footer>
    </Modal>
  );
}

// ── Modal: respostas de uma avaliação ─────────────────────────────────────────

function RespostasModal({ id, onFechar }: { id: number; onFechar: () => void }) {
  const { data, isLoading } = useDesempenhoDetalhe(id);
  const [aberta, setAberta] = useState<number | null>(null);

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={data?.funcionarioNome ?? "Avaliação de desempenho"}
      subtitulo={data?.titulo}
      largura="max-w-2xl"
    >
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading || !data ? (
          <div className="skeleton h-40" />
        ) : (
          <>
            <p className="mb-4 text-xs text-muted">
              {data.cargo ?? "—"}
              {data.setor ? ` · ${data.setor}` : ""} · aberta em {dataBR(data.criadoEm.slice(0, 10))}
              {data.encerradoEm && ` · encerrada em ${dataBR(data.encerradoEm.slice(0, 10))}`}
            </p>
            {data.respostas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                Nenhum gestor respondeu ainda.
              </p>
            ) : (
              <div className="divide-y divide-hairline/60">
                {data.respostas.map((r) => {
                  const expandida = aberta === r.id;
                  return (
                    <div key={r.id} className="py-2.5">
                      <button
                        onClick={() => setAberta(expandida ? null : r.id)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{r.nome}</p>
                          <p className="truncate text-xs text-muted">
                            {r.email ? `${r.email} · ` : ""}
                            {dataHoraBR(r.respondidoEm)}
                          </p>
                        </div>
                        <Badge tone="good" size="xs" uppercase className="shrink-0">
                          Respondido
                        </Badge>
                      </button>
                      {expandida && (
                        <div className="mt-3 rounded-lg border border-hairline p-3">
                          <CamposFormulario
                            campos={data.formulario.campos}
                            valores={r.valores as RespostaValores}
                            somenteLeitura
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Tela ──────────────────────────────────────────────────────────────────────

function Kpi({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <Card padding="none" animate="none" className="px-4 py-3">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className={clsx("mt-0.5 text-2xl font-semibold tabular-nums", tom ?? "text-ink")}>
        {valor}
      </p>
    </Card>
  );
}

export default function Conteudo() {
  const [empresa, setEmpresa] = useState<number | "">("");
  const [setor, setSetor] = useState("");
  const [formulario, setFormulario] = useState<number | "">("");
  const [rodada, setRodada] = useState<number | "">("");
  const [status, setStatus] = useState<StatusDesempenho | "">("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(false);
  const [verId, setVerId] = useState<number | null>(null);
  const [agindo, setAgindo] = useState<number | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (empresa !== "") p.set("empresa", String(empresa));
    if (setor) p.set("setor", setor);
    if (formulario !== "") p.set("formulario", String(formulario));
    if (rodada !== "") p.set("rodada", String(rodada));
    if (status) p.set("status", status);
    if (de) p.set("de", de);
    if (ate) p.set("ate", ate);
    if (busca.trim()) p.set("busca", busca.trim());
    return p.toString();
  }, [empresa, setor, formulario, rodada, status, de, ate, busca]);

  const { data, isLoading } = useDesempenho(qs);
  const { data: setores } = useRhSetores();
  const { data: formularios } = useFormularios();
  const { data: rodadas } = useDesempenhoRodadas();
  const queryClient = useQueryClient();

  const itens = useMemo(() => data ?? [], [data]);
  const temFiltro = qs.length > 0;

  const kpis = useMemo(() => {
    let aguardando = 0;
    let respondidas = 0;
    let semGestor = 0;
    let respostas = 0;
    for (const i of itens) {
      if (i.status === "respondido") respondidas++;
      else aguardando++;
      if (i.gestores === 0) semGestor++;
      respostas += i.respostas;
    }
    return { total: itens.length, aguardando, respondidas, semGestor, respostas };
  }, [itens]);

  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ["rh-desempenho"] });
    queryClient.invalidateQueries({ queryKey: ["rh-desempenho-rodadas"] });
  };

  const acao = async (i: DesempenhoItem, acaoNome: "reenviar" | "encerrar" | "reabrir") => {
    setAgindo(i.id);
    try {
      await mutar("/api/rh/desempenho", "PATCH", { id: i.id, acao: acaoNome });
      recarregar();
      toast.success(
        acaoNome === "reenviar"
          ? `Avaliação reenviada aos gestores (${i.gestores})`
          : acaoNome === "encerrar"
            ? "Avaliação encerrada — o link não aceita mais respostas"
            : "Avaliação reaberta"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na ação");
    } finally {
      setAgindo(null);
    }
  };

  const excluir = async (i: DesempenhoItem) => {
    if (
      !confirm(
        `Excluir a avaliação de ${i.nome} (${i.rodadaTitulo})? As ${i.respostas} resposta(s) vão junto.`
      )
    )
      return;
    setAgindo(i.id);
    try {
      await mutar(`/api/rh/desempenho?id=${i.id}`, "DELETE");
      recarregar();
      toast.success("Avaliação excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    } finally {
      setAgindo(null);
    }
  };

  const limpar = () => {
    setEmpresa("");
    setSetor("");
    setFormulario("");
    setRodada("");
    setStatus("");
    setDe("");
    setAte("");
    setBusca("");
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Avaliações sobre o colaborador, respondidas pelos gestores do setor dele.
        </p>
        <Button variant="primary" onClick={() => setNova(true)}>
          <Plus className="size-4" /> Nova avaliação
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi rotulo="Avaliações" valor={kpis.total} />
        <Kpi rotulo="Aguardando" valor={kpis.aguardando} tom="text-warning" />
        <Kpi rotulo="Respondidas" valor={kpis.respondidas} tom="text-good" />
        <Kpi rotulo="Respostas de gestores" valor={kpis.respostas} />
      </div>

      {/* Filtros — a tela lê só o banco do app, então filtram ao vivo. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar colaborador"
            className={`${CAMPO} w-52 pl-8`}
          />
        </div>
        <select
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value ? Number(e.target.value) : "")}
          className={CAMPO}
        >
          <option value="">Todas as empresas</option>
          {EMPRESAS_RH.map((c) => (
            <option key={c} value={c}>
              {nomeEmpresaRh(c)}
            </option>
          ))}
        </select>
        <select value={setor} onChange={(e) => setSetor(e.target.value)} className={CAMPO}>
          <option value="">Todos os setores</option>
          {(setores ?? []).map((s) => (
            <option key={s.classiforgan} value={s.classiforgan}>
              {s.nome}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus((e.target.value || "") as StatusDesempenho | "")}
          className={CAMPO}
        >
          <option value="">Todos os status</option>
          {STATUS_DESEMPENHO.map((s) => (
            <option key={s} value={s}>
              {STATUS_DESEMPENHO_ROTULO[s]}
            </option>
          ))}
        </select>
        <select
          value={formulario}
          onChange={(e) => setFormulario(e.target.value ? Number(e.target.value) : "")}
          className={CAMPO}
        >
          <option value="">Todos os formulários</option>
          {(formularios ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <select
          value={rodada}
          onChange={(e) => setRodada(e.target.value ? Number(e.target.value) : "")}
          className={CAMPO}
        >
          <option value="">Todas as rodadas</option>
          {(rodadas ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.titulo} · {dataBR(r.criadoEm.slice(0, 10))} ({r.respondidas}/{r.avaliacoes})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted">
          de
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          até
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className={CAMPO}
          />
        </label>
        {temFiltro && (
          <Button variant="link" onClick={limpar} className="text-xs">
            Limpar filtros
          </Button>
        )}
      </div>

      <Card overflow padding="none" animate="none">
        <div className="max-h-[42rem] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pl-4 pr-3 text-left font-medium">Colaborador</th>
                <th className="py-2 px-3 text-left font-medium">Avaliação</th>
                <th className="py-2 px-3 text-left font-medium">Enviada</th>
                <th className="py-2 px-3 text-left font-medium">Situação</th>
                <th className="py-2 px-3 text-left font-medium">Respostas</th>
                <th className="py-2 pl-3 pr-4 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className="border-b border-hairline/60 align-top last:border-0">
                  <td className="py-3 pl-4 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                        <UserRound className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{i.nome}</span>
                          <SeloEmpresa codigo={i.codigoempresa} />
                        </div>
                        <p className="text-[11px] text-muted">
                          {i.cargo ?? "—"}
                          {i.setor ? ` · ${i.setor}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-ink-2">{i.rodadaTitulo}</p>
                    <p className="text-[11px] text-muted">
                      {i.formularioNome}
                      {i.escopo === "escritorio" ? " · escritório inteiro" : ""}
                    </p>
                  </td>
                  <td className="py-3 px-3">
                    <p className="tabular-nums text-ink-2">
                      {i.enviadoEm ? dataBR(i.enviadoEm.slice(0, 10)) : "—"}
                    </p>
                    {i.encerradoEm && (
                      <p className="text-[11px] text-muted">
                        encerrada {dataBR(i.encerradoEm.slice(0, 10))}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <Badge tone={STATUS_TONE[i.status]} size="xs" uppercase>
                      {i.status === "respondido" && <CheckCircle2 className="size-3" />}
                      {i.status === "enviado" && <Clock className="size-3" />}
                      {i.status === "erro" && <AlertTriangle className="size-3" />}
                      {STATUS_DESEMPENHO_ROTULO[i.status]}
                    </Badge>
                    {i.gestores === 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-warning">
                        <AlertTriangle className="size-3" /> sem gestor no setor
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <p className="tabular-nums text-ink-2">
                      {i.respostas} de {i.gestores || "?"} gestor(es)
                    </p>
                    {i.respondentes.length > 0 && (
                      <p className="text-[11px] text-muted">{i.respondentes.join(", ")}</p>
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setVerId(i.id)}
                        disabled={i.respostas === 0}
                        title={i.respostas === 0 ? "Ninguém respondeu ainda" : "Ver respostas"}
                      >
                        <Eye className="size-3.5" /> Ver
                      </Button>
                      {!i.encerradoEm && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => acao(i, "reenviar")}
                          disabled={i.gestores === 0 || agindo === i.id}
                          title={
                            i.gestores === 0
                              ? "Cadastre um gestor no setor"
                              : "Reenviar aos gestores do setor"
                          }
                        >
                          <Send className="size-3.5" />
                        </Button>
                      )}
                      <IconButton
                        size="sm"
                        onClick={() => acao(i, i.encerradoEm ? "reabrir" : "encerrar")}
                        disabled={agindo === i.id}
                        className="border border-hairline"
                        title={
                          i.encerradoEm
                            ? "Reabrir para novas respostas"
                            : "Encerrar (o link para de aceitar respostas)"
                        }
                        aria-label={i.encerradoEm ? "Reabrir avaliação" : "Encerrar avaliação"}
                      >
                        {i.encerradoEm ? (
                          <LockOpen className="size-3.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                      </IconButton>
                      <IconButton
                        tone="danger"
                        size="sm"
                        onClick={() => excluir(i)}
                        disabled={agindo === i.id}
                        className="border border-hairline"
                        title="Excluir avaliação e respostas"
                        aria-label="Excluir avaliação"
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, k) => (
                        <div key={k} className="skeleton h-12 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && itens.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted">
                    {temFiltro
                      ? "Nenhuma avaliação com esses filtros."
                      : "Nenhuma avaliação de desempenho ainda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {nova && <NovaAvaliacaoModal onFechar={() => setNova(false)} />}
      {verId != null && <RespostasModal id={verId} onFechar={() => setVerId(null)} />}
    </>
  );
}
