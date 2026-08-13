"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Search,
  Send,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { CamposFormulario } from "@/components/formulario-campos";
import { mutar } from "@/hooks/mutar";
import { useEnvio, useEnvios, useRhFuncionarios, useRhGestores } from "@/hooks/use-api";
import { dataBR } from "@/lib/format";
import type { RespostaValores } from "@/lib/formularios-tipos";

/** Quem recebe o link e responde. */
type Destinatario = "gestores" | "colaboradores" | "avulsos";
/** Sobre quem é o formulário (só faz sentido quando quem responde é o gestor). */
type Escopo = "generico" | "sobre_colaborador";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const linhasEmail = (s: string) =>
  s
    .split(/[\n,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => EMAIL_RE.test(x));

// ── Modal: enviar um formulário ───────────────────────────────────────────────

export function EnviarModal({
  formularioId,
  formularioNome,
  onFechar,
}: {
  formularioId: number;
  formularioNome: string;
  onFechar: () => void;
}) {
  const { data: gestores } = useRhGestores();
  const queryClient = useQueryClient();

  // Dois eixos independentes: quem responde × sobre quem.
  const [destinatario, setDestinatario] = useState<Destinatario>("gestores");
  const [escopo, setEscopo] = useState<Escopo>("generico");
  const [titulo, setTitulo] = useState(formularioNome);
  const [mensagem, setMensagem] = useState("");
  const [selec, setSelec] = useState<Set<number>>(new Set());
  const [avulsos, setAvulsos] = useState("");
  const [selecColab, setSelecColab] = useState<Set<string>>(new Set());
  const [buscaColab, setBuscaColab] = useState("");
  const [agendar, setAgendar] = useState(false);
  const [quando, setQuando] = useState("");
  const [enviando, setEnviando] = useState(false);

  // "Sobre um colaborador" só existe quando quem responde é o gestor.
  const sobreColaborador = destinatario === "gestores" && escopo === "sobre_colaborador";
  // A lista de colaboradores aparece em dois casos: gestor avaliando um colaborador,
  // ou o próprio colaborador respondendo.
  const usaColaboradores = sobreColaborador || destinatario === "colaboradores";
  const { data: funcionarios } = useRhFuncionarios(usaColaboradores);

  const lista = useMemo(() => (gestores ?? []).filter((g) => g.ativo), [gestores]);
  const todosMarcados = lista.length > 0 && selec.size === lista.length;

  // Departamentos (classiforgan) com ao menos um gestor ativo — só sobre esses
  // dá para o gestor avaliar um colaborador.
  const deptComGestor = useMemo(() => new Set(lista.map((g) => g.classiforgan)), [lista]);

  const colabKey = (empresa: number, contrato: number) => `${empresa}:${contrato}`;

  const colabFiltrados = useMemo(() => {
    const q = buscaColab.trim().toLowerCase();
    const todos = funcionarios ?? [];
    if (!q) return todos;
    return todos.filter((f) =>
      [f.nome, f.setor, f.cargo].some((v) => v?.toLowerCase().includes(q))
    );
  }, [funcionarios, buscaColab]);

  // Um colaborador é "válido" conforme o modo: para o gestor avaliar precisa de
  // gestor no depto; para responder direto precisa de e-mail cadastrado.
  const colabInvalido = (f: { classiforgan: string | null; email: string | null }) =>
    sobreColaborador ? f.classiforgan == null || !deptComGestor.has(f.classiforgan) : !f.email;

  const colabValidos = useMemo(
    () =>
      (funcionarios ?? []).filter(
        (f) => selecColab.has(colabKey(f.codigoempresa, f.contrato)) && !colabInvalido(f)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [funcionarios, selecColab, deptComGestor, sobreColaborador]
  );
  const colabInvalidos = selecColab.size - colabValidos.length;

  const alternar = (id: number) =>
    setSelec((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const marcarTodos = () =>
    setSelec(todosMarcados ? new Set() : new Set(lista.map((g) => g.id)));

  const alternarColab = (empresa: number, contrato: number) =>
    setSelecColab((s) => {
      const k = colabKey(empresa, contrato);
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  // "Selecionar todos" age sobre o resultado atual da busca, preservando os que já
  // estavam marcados fora do filtro.
  const chavesFiltradas = useMemo(
    () => colabFiltrados.map((f) => colabKey(f.codigoempresa, f.contrato)),
    [colabFiltrados]
  );
  const todosColabMarcados =
    chavesFiltradas.length > 0 && chavesFiltradas.every((k) => selecColab.has(k));
  const marcarTodosColab = () =>
    setSelecColab((s) => {
      const n = new Set(s);
      if (todosColabMarcados) for (const k of chavesFiltradas) n.delete(k);
      else for (const k of chavesFiltradas) n.add(k);
      return n;
    });

  const totalGestores = useMemo(() => {
    const emails = new Set<string>();
    for (const g of lista) if (selec.has(g.id)) emails.add(g.email.toLowerCase());
    return emails.size;
  }, [lista, selec]);
  const totalAvulsos = useMemo(() => new Set(linhasEmail(avulsos)).size, [avulsos]);

  const total =
    destinatario === "gestores"
      ? sobreColaborador
        ? colabValidos.length
        : totalGestores
      : destinatario === "colaboradores"
        ? colabValidos.length
        : totalAvulsos;

  // Rótulo do que se conta: avaliações (1 por colaborador aos gestores) vs. links.
  const rotuloAlvo = sobreColaborador ? "avaliação(ões)" : "destinatário(s)";

  const enviar = async () => {
    if (total === 0) {
      return toast.error(
        destinatario === "gestores"
          ? sobreColaborador
            ? "Selecione ao menos um colaborador com gestor no depto"
            : "Selecione ao menos um gestor"
          : destinatario === "colaboradores"
            ? "Selecione ao menos um colaborador com e-mail"
            : "Informe ao menos um e-mail"
      );
    }
    if (agendar && !quando) return toast.error("Escolha a data e a hora do agendamento");

    const corpo: Record<string, unknown> = {
      formularioId,
      titulo,
      mensagem,
      agendarPara: agendar && quando ? new Date(quando).toISOString() : null,
    };
    if (destinatario === "gestores" && !sobreColaborador) {
      corpo.destinatarios = lista
        .filter((g) => selec.has(g.id))
        .map((g) => ({ email: g.email, nome: g.nome, gestorId: g.id }));
    } else if (sobreColaborador) {
      corpo.colaboradores = colabValidos.map((f) => ({
        codigoempresa: f.codigoempresa,
        codigofunccontr: f.contrato,
        nome: f.nome,
        classiforgan: f.classiforgan,
      }));
    } else if (destinatario === "colaboradores") {
      corpo.destinatarios = colabValidos.map((f) => ({ email: f.email, nome: f.nome }));
    } else {
      corpo.destinatarios = linhasEmail(avulsos).map((email) => ({ email }));
    }

    setEnviando(true);
    try {
      const r = await mutar<{
        enviados: number;
        total: number;
        agendado: boolean;
        semGestor: string[];
      }>("/api/rh/envios", "POST", corpo);
      queryClient.invalidateQueries({ queryKey: ["rh-envios"] });
      toast.success(
        r.agendado
          ? `Campanha agendada — ${r.total} ${rotuloAlvo}`
          : `Enviado — ${r.total} ${rotuloAlvo}`
      );
      if (r.semGestor?.length) {
        toast.warning(
          `${r.semGestor.length} colaborador(es) sem gestor no depto foram ignorados`
        );
      }
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  const opcoesDest: { v: Destinatario; rot: string; Icone: typeof Users }[] = [
    { v: "gestores", rot: "Gestores", Icone: Users },
    { v: "colaboradores", rot: "Colaboradores", Icone: User },
    { v: "avulsos", rot: "E-mails avulsos", Icone: Mail },
  ];

  return (
    <Modal aberto onFechar={onFechar} titulo="Enviar formulário" subtitulo={formularioNome} largura="max-w-xl">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {/* Eixo 1 — quem responde */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Quem responde</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-hairline p-1">
            {opcoesDest.map(({ v, rot, Icone }) => (
              <button
                key={v}
                onClick={() => setDestinatario(v)}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  destinatario === v ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2"
                )}
              >
                <Icone className="size-4" />
                {rot}
              </button>
            ))}
          </div>
        </div>

        {/* Eixo 2 — sobre quem (só quando o gestor responde) */}
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

        <p className="text-xs text-muted">
          {destinatario === "avulsos"
            ? "Cada e-mail recebe um link próprio e responde uma vez."
            : sobreColaborador
              ? "Cada colaborador vira uma avaliação enviada ao gestor do departamento dele — uma resposta por colaborador."
              : destinatario === "colaboradores"
                ? "Cada colaborador recebe no próprio e-mail um link para responder uma vez."
                : "Cada gestor recebe um link próprio e responde uma vez."}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Assunto do e-mail</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="h-9 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
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

        {/* Alvos conforme os eixos */}
        {destinatario === "gestores" && !sobreColaborador && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-2">Gestores cadastrados</span>
              {lista.length > 0 && (
                <Button variant="link" onClick={marcarTodos} className="text-xs">
                  {todosMarcados ? "Limpar" : "Selecionar todos"}
                </Button>
              )}
            </div>
            {lista.length === 0 ? (
              <p className="rounded-lg border border-hairline px-3 py-2 text-xs text-muted">
                Nenhum gestor cadastrado. Cadastre em Gestores ou use E-mails avulsos.
              </p>
            ) : (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-hairline p-1.5">
                {lista.map((g) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={selec.has(g.id)}
                      onChange={() => alternar(g.id)}
                      className="size-3.5 accent-ink"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.nome}</span>
                    <span className="truncate text-xs text-muted">{g.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {destinatario === "avulsos" && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">E-mails (um por linha)</span>
            <textarea
              value={avulsos}
              onChange={(e) => setAvulsos(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
              placeholder="fulano@empresa.com.br"
            />
          </label>
        )}

        {usaColaboradores && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-2">Colaboradores</span>
              {chavesFiltradas.length > 0 && (
                <Button variant="link" onClick={marcarTodosColab} className="text-xs">
                  {todosColabMarcados ? "Limpar" : "Selecionar todos"}
                </Button>
              )}
            </div>
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
              <div className="skeleton h-44 rounded-lg" />
            ) : colabFiltrados.length === 0 ? (
              <p className="rounded-lg border border-hairline px-3 py-2 text-xs text-muted">
                Nenhum colaborador encontrado.
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-hairline p-1.5">
                {colabFiltrados.map((f) => {
                  const k = colabKey(f.codigoempresa, f.contrato);
                  const invalido = colabInvalido(f);
                  return (
                    <label
                      key={k}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={selecColab.has(k)}
                        onChange={() => alternarColab(f.codigoempresa, f.contrato)}
                        className="size-3.5 accent-ink"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.nome}</span>
                      {f.origem === "pj" && (
                        <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                          PJ
                        </span>
                      )}
                      {invalido ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-warning">
                          <AlertTriangle className="size-3" />
                          {sobreColaborador ? "sem gestor" : "sem e-mail"}
                        </span>
                      ) : (
                        <span className="shrink-0 truncate text-xs text-muted">
                          {sobreColaborador ? f.setor ?? "—" : f.email}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {colabInvalidos > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning">
                <AlertTriangle className="size-3" />
                {colabInvalidos} selecionado(s) {sobreColaborador ? "sem gestor no depto" : "sem e-mail"} — não
                serão enviados.
              </p>
            )}
          </div>
        )}

        {/* Agendamento */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={agendar}
              onChange={(e) => setAgendar(e.target.checked)}
              className="size-3.5 accent-ink"
            />
            Agendar envio
          </label>
          {agendar && (
            <input
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className="h-9 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
            />
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-3">
        <span className="text-xs text-muted">{`${total} ${rotuloAlvo}`}</span>
        <Button variant="primary" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : agendar ? <CalendarClock className="size-4" /> : <Send className="size-4" />}
          {enviando ? "Enviando…" : agendar ? "Agendar" : "Enviar agora"}
        </Button>
      </footer>
    </Modal>
  );
}

// ── Lista de campanhas ────────────────────────────────────────────────────────

export function EnviosLista() {
  const { data, isLoading } = useEnvios();
  const [verId, setVerId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }
  if ((data ?? []).length === 0) {
    return <EmptyState icon={<Send className="size-5" />} titulo="Nenhuma campanha ainda." />;
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-surface">
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pl-4 pr-3 text-left font-medium">Campanha</th>
                <th className="py-2 px-3 text-left font-medium">Formulário</th>
                <th className="py-2 px-3 text-left font-medium">Quando</th>
                <th className="py-2 px-3 text-left font-medium">Respostas</th>
                <th className="py-2 pl-3 pr-4 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((e) => {
                const agendadaPendente = !e.disparadoEm && e.agendadoPara;
                return (
                  <tr key={e.id} className="border-b border-hairline/60 last:border-0">
                    <td className="py-3 pl-4 pr-3 font-medium text-ink">{e.titulo}</td>
                    <td className="py-3 px-3 text-ink-2">{e.formularioNome}</td>
                    <td className="py-3 px-3">
                      {e.disparadoEm ? (
                        <span className="inline-flex items-center gap-1 text-ink-2">
                          <CheckCircle2 className="size-3.5 text-good" />
                          {dataBR(e.disparadoEm.slice(0, 10))}
                        </span>
                      ) : agendadaPendente ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <Clock className="size-3.5" /> agendada {dataBR(e.agendadoPara!.slice(0, 10))}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 tabular-nums text-ink-2">
                      {e.respondidos} / {e.total}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setVerId(e.id)}>
                        Ver respostas
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {verId != null && <RespostasModal envioId={verId} onFechar={() => setVerId(null)} />}
    </>
  );
}

// ── Modal: respostas de uma campanha ──────────────────────────────────────────

function RespostasModal({ envioId, onFechar }: { envioId: number; onFechar: () => void }) {
  const { data, isLoading } = useEnvio(envioId);
  const [aberto, setAberto] = useState<number | null>(null);

  return (
    <Modal aberto onFechar={onFechar} titulo={data?.titulo ?? "Respostas"} largura="max-w-2xl">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading || !data ? (
          <div className="skeleton h-40" />
        ) : (
          <div className="divide-y divide-hairline/60">
            {data.destinatarios.map((d) => {
              const respondeu = d.status === "respondido";
              const expandido = aberto === d.id;
              return (
                <div key={d.id} className="py-2.5">
                  <button
                    onClick={() => respondeu && setAberto(expandido ? null : d.id)}
                    className={clsx(
                      "flex w-full items-center justify-between gap-3 text-left",
                      respondeu && "cursor-pointer"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {d.funcionarioNome || d.nome || d.email}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {d.funcionarioNome
                          ? d.respondidoPorNome
                            ? `Sobre colaborador · respondido por ${d.respondidoPorNome}`
                            : "Sobre colaborador"
                          : d.email}
                      </p>
                    </div>
                    <Badge
                      tone={respondeu ? "good" : d.status === "erro" ? "critical" : "neutral"}
                      size="xs"
                      uppercase
                      className="shrink-0"
                    >
                      {respondeu ? "Respondido" : d.status === "erro" ? "Erro" : "Aguardando"}
                    </Badge>
                  </button>
                  {expandido && respondeu && (
                    <div className="mt-3 rounded-lg border border-hairline p-3">
                      <CamposFormulario
                        campos={data.formulario.campos}
                        valores={(d.valores ?? {}) as RespostaValores}
                        somenteLeitura
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {data.destinatarios.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">Sem destinatários.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
