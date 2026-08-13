"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { Link2, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { LinkPublico } from "@/components/link-publico";
import { StatusDenunciaBadge } from "@/components/denuncia-status";
import { useDenuncia, useDenuncias } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataHoraBR } from "@/lib/format";
import {
  CATEGORIAS_DENUNCIA,
  CATEGORIA_DENUNCIA_ROTULO,
  STATUS_DENUNCIA,
  STATUS_DENUNCIA_ROTULO,
  type StatusDenuncia,
} from "@/lib/denuncia-tipos";

const CAMPO = "h-9 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30";

export default function Conteudo() {
  const [status, setStatus] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
  const [abrir, setAbrir] = useState<number | null>(null);
  const [mostrarLink, setMostrarLink] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "todas") p.set("status", status);
    if (categoria !== "todas") p.set("categoria", categoria);
    return p.toString();
  }, [status, categoria]);

  const { data, isLoading } = useDenuncias(qs);
  const d = data?.dashboard;
  const lista = data?.denuncias ?? [];

  return (
    <div className="space-y-4">
      {/* Divulgação do canal */}
      <Card padding="sm" animate="none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Canal público de denúncia</h2>
            <p className="text-xs text-muted">Divulgue este link no comunicado interno / intranet. O acesso é anônimo.</p>
          </div>
          <Button variant="secondary" onClick={() => setMostrarLink((v) => !v)} className="shrink-0">
            <Link2 className="size-4" />
            {mostrarLink ? "Ocultar link" : "Ver link"}
          </Button>
        </div>
        {mostrarLink && (
          <div className="mt-3">
            <LinkPublico caminho="/denuncia" />
          </div>
        )}
      </Card>

      {/* Mini-dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile rotulo="Total" valor={d?.total ?? 0} />
        <Tile rotulo="Aguardando RH" valor={d?.aguardandoRh ?? 0} tom={d?.aguardandoRh ? "text-warning" : undefined} />
        <Tile rotulo="Em análise" valor={d?.porStatus.em_analise ?? 0} />
        <Tile
          rotulo="Tempo 1ª resposta"
          valor={d?.horasPrimeiraResposta == null ? "—" : formatarHoras(d.horasPrimeiraResposta)}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={CAMPO}>
          <option value="todas">Todos os status</option>
          {STATUS_DENUNCIA.map((s) => (
            <option key={s} value={s}>
              {STATUS_DENUNCIA_ROTULO[s]}
            </option>
          ))}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={CAMPO}>
          <option value="todas">Todos os assuntos</option>
          {CATEGORIAS_DENUNCIA.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_DENUNCIA_ROTULO[c]}
            </option>
          ))}
        </select>
      </div>

      {/* Fila */}
      <Card overflow padding="none" animate="none">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : lista.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">
            Nenhuma denúncia {status !== "todas" || categoria !== "todas" ? "com esses filtros" : "registrada"}.
          </p>
        ) : (
          <ul>
            {lista.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setAbrir(item.id)}
                  className="flex w-full items-center gap-3 border-b border-hairline/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-2"
                >
                  {item.aguardandoRh && (
                    <span className="size-2 shrink-0 rounded-full bg-warning" title="Aguardando resposta do RH" />
                  )}
                  {!item.aguardandoRh && <span className="size-2 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-ink">{item.protocolo}</span>
                      <StatusDenunciaBadge status={item.status} />
                    </div>
                    <p className="truncate text-xs text-muted">
                      {CATEGORIA_DENUNCIA_ROTULO[item.categoria]}
                      {item.setorEnvolvido ? ` · ${item.setorEnvolvido}` : ""} · {dataHoraBR(item.criadoEm)}
                    </p>
                  </div>
                  {item.mensagens > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                      <MessageSquare className="size-3.5" />
                      {item.mensagens}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {abrir != null && <DetalheModal id={abrir} onFechar={() => setAbrir(null)} />}
    </div>
  );
}

function Tile({ rotulo, valor, tom }: { rotulo: string; valor: string | number; tom?: string }) {
  return (
    <Card padding="sm" animate="none">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className={clsx("mt-1 text-2xl font-semibold tnum", tom ?? "text-ink")}>{valor}</p>
    </Card>
  );
}

function formatarHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.round(horas)} h`;
  return `${Math.round(horas / 24)} d`;
}

function DetalheModal({ id, onFechar }: { id: number; onFechar: () => void }) {
  const { data, isLoading } = useDenuncia(id);
  const qc = useQueryClient();
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["rh-denuncia", id] });
    qc.invalidateQueries({ queryKey: ["rh-denuncias"] });
  };

  const responder = async () => {
    if (!resposta.trim()) return;
    setEnviando(true);
    try {
      await mutar("/api/rh/denuncias", "PATCH", { id, acao: "responder", corpo: resposta });
      setResposta("");
      invalidar();
      toast.success("Resposta enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao responder");
    } finally {
      setEnviando(false);
    }
  };

  const mudarStatus = async (status: StatusDenuncia) => {
    setSalvandoStatus(true);
    try {
      await mutar("/api/rh/denuncias", "PATCH", { id, acao: "status", status });
      invalidar();
      toast.success("Status atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mudar o status");
    } finally {
      setSalvandoStatus(false);
    }
  };

  const encerrada = data?.status === "concluida" || data?.status === "arquivada";

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-semibold text-ink">{data?.protocolo ?? "Denúncia"}</span>
          {data && <StatusDenunciaBadge status={data.status} />}
        </div>
      }
      subtitulo={
        data ? `${CATEGORIA_DENUNCIA_ROTULO[data.categoria]} · registrada em ${dataHoraBR(data.criadoEm)}` : undefined
      }
      largura="max-w-2xl"
    >
      {isLoading || !data ? (
        <div className="space-y-3 p-6">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {data.setorEnvolvido && (
              <p className="text-xs text-muted">
                Setor/área envolvida: <span className="text-ink-2">{data.setorEnvolvido}</span>
              </p>
            )}

            <section>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Relato</h4>
              <p className="whitespace-pre-wrap text-sm text-ink-2">{data.relato}</p>
            </section>

            {data.mensagens.length > 0 && (
              <section className="space-y-3">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Conversa</h4>
                {data.mensagens.map((m, i) => {
                  const doRh = m.autor === "rh";
                  return (
                    <div key={i} className={doRh ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={clsx(
                          "max-w-[85%] rounded-lg px-3 py-2",
                          doRh ? "rounded-tr-sm bg-ink text-surface" : "rounded-tl-sm bg-surface-2"
                        )}
                      >
                        <p className="mb-0.5 text-[11px] font-medium opacity-70">
                          {doRh ? m.autorNome || "RH" : "Denunciante (anônimo)"} · {dataHoraBR(m.criadoEm)}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{m.corpo}</p>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </div>

          {/* Rodapé fixo: status + resposta */}
          <div className="space-y-3 border-t border-hairline px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Status</span>
              <select
                value={data.status}
                disabled={salvandoStatus}
                onChange={(e) => mudarStatus(e.target.value as StatusDenuncia)}
                className={clsx(CAMPO, "flex-1")}
              >
                {STATUS_DENUNCIA.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_DENUNCIA_ROTULO[s]}
                  </option>
                ))}
              </select>
            </div>

            {encerrada ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-muted">
                Denúncia encerrada — reabra mudando o status para responder novamente.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  rows={2}
                  className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
                  placeholder="Responder ao denunciante (anônimo)…"
                />
                <Button
                  variant="primary"
                  size="lg"
                  onClick={responder}
                  disabled={enviando}
                  className="shrink-0"
                >
                  {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Enviar
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
