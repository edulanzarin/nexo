"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Eye, Send, CheckCircle2, Clock, Settings, Trash2, UserRound } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { SeloEmpresa } from "@/components/rh-selo-empresa";
import { BotaoExecutar } from "@/components/filters/botao-executar";
import { FiltroPendente } from "@/components/filtro-pendente";
import { Modal } from "@/components/ui/modal";
import { CamposFormulario } from "@/components/formulario-campos";
import { useExperienciaConfig, useExperienciaResposta, useRhExperiencia } from "@/hooks/use-api";
import { useEstadoModulo } from "@/hooks/use-estado-modulo";
import { mutar } from "@/hooks/mutar";
import { EMPRESAS_RH, nomeEmpresaRh } from "@/lib/rh";
import { dataBR } from "@/lib/format";
import {
  STATUS_ROTULO,
  rotuloMarco,
  type Marco,
  type StatusExperiencia,
} from "@/lib/rh-experiencia";
import type { ExperienciaItem } from "@/lib/rh-tipos";

type FiltroEmpresa = "todas" | number;

const STATUS_CLASSE: Record<StatusExperiencia, string> = {
  pendente: "bg-surface-2 text-muted",
  enviado: "bg-warning/12 text-warning",
  atraso: "bg-critical/12 text-critical",
  respondido: "bg-good/12 text-good",
};

function prazoTexto(dias: number): string {
  if (dias === 0) return "vence hoje";
  if (dias > 0) return `em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const d = Math.abs(dias);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Config (em modal): qual formulário sai em cada marco e com quanta antecedência. */
function ConfigExperienciaModal({ onFechar }: { onFechar: () => void }) {
  const { data, isLoading } = useExperienciaConfig();
  const queryClient = useQueryClient();
  const marcos: Marco[] = [45, 90];

  const salvar = async (marco: number, formularioId: number | null, diasAntes: number) => {
    try {
      await mutar("/api/rh/experiencia-config", "PUT", { marco, formularioId, diasAntes });
      queryClient.invalidateQueries({ queryKey: ["rh-experiencia-config"] });
      toast.success("Configuração salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  };

  const forms = data?.formularios ?? [];
  const cfgDe = (m: number) => data?.config.find((c) => c.marco === m);

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Configuração da experiência"
      subtitulo="Formulário por marco e antecedência do aviso aos gestores do setor"
      largura="max-w-xl"
    >
      <div className="space-y-3 px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {marcos.map((m) => {
            const cfg = cfgDe(m);
            return (
              <div key={m} className="rounded-lg border border-hairline p-3">
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
                  Marco {rotuloMarco(m)}
                </span>
                <label className="mt-2 block text-xs text-muted">
                  Formulário
                  <select
                    value={cfg?.formularioId ?? ""}
                    onChange={(e) =>
                      salvar(m, e.target.value ? Number(e.target.value) : null, cfg?.diasAntes ?? 7)
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-hairline bg-surface px-2 text-sm text-ink outline-none focus:border-ink/30"
                  >
                    <option value="">Não enviar</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-2 block text-xs text-muted">
                  Antecedência (dias antes do fim)
                  <input
                    key={`${m}-${cfg?.formularioId ?? "x"}-${cfg?.diasAntes ?? 7}`}
                    type="number"
                    min={0}
                    max={60}
                    defaultValue={cfg?.diasAntes ?? 7}
                    disabled={!cfg}
                    onBlur={(e) => cfg && salvar(m, cfg.formularioId, Number(e.target.value))}
                    className="mt-1 h-9 w-24 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-ink/30 disabled:opacity-50"
                  />
                </label>
              </div>
            );
          })}
        </div>

        {!isLoading && forms.length === 0 && (
          <p className="text-xs text-warning">
            Nenhum formulário ativo. Crie um em Formulários e marque como “Ativo” para poder ligá-lo à
            experiência.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Modal de leitura das respostas de uma avaliação de experiência respondida. */
function RespostasExperienciaModal({ id, onFechar }: { id: number; onFechar: () => void }) {
  const { data, isLoading } = useExperienciaResposta(id);
  return (
    <Modal aberto onFechar={onFechar} titulo="Respostas da avaliação" largura="max-w-2xl">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading || !data ? (
          <div className="skeleton h-40" />
        ) : (
          <>
            <p className="mb-4 text-xs text-muted">
              Respondido por <span className="font-medium text-ink-2">{data.respondidoPorNome ?? "—"}</span>
              {data.respondidoEm && ` em ${dataBR(data.respondidoEm.slice(0, 10))}`}
            </p>
            <CamposFormulario campos={data.formulario.campos} valores={data.valores} somenteLeitura />
          </>
        )}
      </div>
    </Modal>
  );
}

function Kpi({ rotulo, valor, tom }: { rotulo: string; valor: number; tom: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className={clsx("mt-0.5 text-2xl font-semibold tabular-nums", tom)}>{valor}</p>
    </div>
  );
}

export default function Conteudo() {
  const [empresa, setEmpresa] = useEstadoModulo<FiltroEmpresa>("rh/experiencia:empresa", "todas");
  const qs = empresa === "todas" ? "" : `empresa=${empresa}`;
  // Nada consulta até o Visualizar (padrão executar-por-botão); persiste no módulo.
  const [qsAplicado, setQsAplicado] = useEstadoModulo<string | null>(
    "rh/experiencia:qsAplicado",
    null
  );
  const { data, isLoading } = useRhExperiencia(qsAplicado ?? "", qsAplicado != null);
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  const [verResp, setVerResp] = useState<number | null>(null);

  const dirty = qsAplicado !== qs;
  const executar = () => {
    setQsAplicado(qs);
    queryClient.invalidateQueries({ queryKey: ["rh-experiencia"] });
  };

  const itens = useMemo(() => data ?? [], [data]);

  const kpis = useMemo(() => {
    let atraso = 0;
    let aVencer = 0;
    let respondido = 0;
    let semGestor = 0;
    for (const i of itens) {
      if (i.status === "respondido") respondido++;
      else if (i.status === "atraso") atraso++;
      else aVencer++;
      if (i.status !== "respondido" && i.gestores === 0) semGestor++;
    }
    return { atraso, aVencer, respondido, semGestor };
  }, [itens]);

  const chave = (i: ExperienciaItem) => `${i.codigoempresa}-${i.contrato}-${i.marco}`;

  const reenviar = async (i: ExperienciaItem) => {
    setEnviando(chave(i));
    try {
      const r = await mutar<{ enviado: boolean; destinatarios: string[] }>(
        "/api/rh/experiencia-reenviar",
        "POST",
        { codigoempresa: i.codigoempresa, contrato: i.contrato, marco: i.marco }
      );
      queryClient.invalidateQueries({ queryKey: ["rh-experiencia"] });
      toast.success(
        r.enviado
          ? `Formulário enviado para ${r.destinatarios.length} gestor(es)`
          : "Formulário registrado (e-mail não configurado — ver log do servidor)"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setEnviando(null);
    }
  };

  const excluir = async (i: ExperienciaItem) => {
    if (i.id == null) return;
    if (
      !confirm(
        `Excluir a avaliação de ${i.marco} dias de ${i.nome}? As respostas e o histórico de avisos vão junto. A pessoa volta a aparecer como pendente.`
      )
    )
      return;
    setExcluindo(i.id);
    try {
      await mutar(`/api/rh/experiencia?id=${i.id}`, "DELETE");
      queryClient.invalidateQueries({ queryKey: ["rh-experiencia"] });
      toast.success("Avaliação excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    } finally {
      setExcluindo(null);
    }
  };

  const segmentos: { valor: FiltroEmpresa; rotulo: string }[] = [
    { valor: "todas", rotulo: "Todas" },
    ...EMPRESAS_RH.map((cod) => ({ valor: cod as FiltroEmpresa, rotulo: nomeEmpresaRh(cod) })),
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
          {segmentos.map((s) => (
            <button
              key={String(s.valor)}
              onClick={() => setEmpresa(s.valor)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                empresa === s.valor ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
              )}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfigAberta(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Settings className="size-4" /> Configurar
          </button>
          <BotaoExecutar onClick={executar} dirty={dirty} rotulo="Visualizar" />
        </div>
      </div>

      {qsAplicado == null ? (
        <FiltroPendente rotulo="Visualizar" />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi rotulo="A vencer" valor={kpis.aVencer} tom="text-ink" />
        <Kpi rotulo="Em atraso" valor={kpis.atraso} tom="text-critical" />
        <Kpi rotulo="Respondidos" valor={kpis.respondido} tom="text-good" />
        <Kpi rotulo="Sem gestor" valor={kpis.semGestor} tom="text-warning" />
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[42rem] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pl-4 pr-3 text-left font-medium">Funcionário</th>
                <th className="py-2 px-3 text-left font-medium">Marco</th>
                <th className="py-2 px-3 text-left font-medium">Vencimento</th>
                <th className="py-2 px-3 text-left font-medium">Situação</th>
                <th className="py-2 px-3 text-left font-medium">Gestores</th>
                <th className="py-2 pl-3 pr-4 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr
                  key={chave(i)}
                  className="border-b border-hairline/60 last:border-0 align-top"
                >
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
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
                      {rotuloMarco(i.marco)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <p className="tabular-nums text-ink-2">{dataBR(i.vencimento)}</p>
                    <p
                      className={clsx(
                        "text-[11px]",
                        i.diasParaVencer < 0 ? "text-critical" : "text-muted"
                      )}
                    >
                      {prazoTexto(i.diasParaVencer)}
                    </p>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        STATUS_CLASSE[i.status]
                      )}
                    >
                      {i.status === "respondido" && <CheckCircle2 className="size-3" />}
                      {i.status === "atraso" && <AlertTriangle className="size-3" />}
                      {i.status === "enviado" && <Clock className="size-3" />}
                      {STATUS_ROTULO[i.status]}
                    </span>
                    {i.resposta && (
                      <p className="mt-1 text-[11px] text-muted/80">por {i.resposta.respondidoPor}</p>
                    )}
                    {i.ultimoLembrete && !i.resposta && (
                      <p className="mt-1 text-[11px] text-muted">
                        último aviso {dataBR(i.ultimoLembrete.slice(0, 10))}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {i.gestores === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-warning">
                        <AlertTriangle className="size-3" /> nenhum
                      </span>
                    ) : (
                      <span className="text-ink-2 tabular-nums">{i.gestores}</span>
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {i.status === "respondido" ? (
                        <button
                          onClick={() => setVerResp(i.id)}
                          disabled={i.id == null}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                        >
                          <Eye className="size-3.5" /> Ver respostas
                        </button>
                      ) : (
                        <button
                          onClick={() => reenviar(i)}
                          disabled={i.gestores === 0 || enviando === chave(i)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                          title={i.gestores === 0 ? "Cadastre um gestor no setor" : "Enviar formulário agora"}
                        >
                          <Send className="size-3.5" />
                          {enviando === chave(i) ? "Enviando…" : i.ultimoLembrete ? "Reenviar" : "Enviar"}
                        </button>
                      )}
                      {i.id != null && (
                        <button
                          onClick={() => excluir(i)}
                          disabled={excluindo === i.id}
                          className="grid size-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:bg-critical/12 hover:text-critical disabled:opacity-40"
                          title="Excluir avaliação e respostas"
                          aria-label="Excluir avaliação"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && itens.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted">
                    Nenhum contrato em experiência no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {configAberta && <ConfigExperienciaModal onFechar={() => setConfigAberta(false)} />}
      {verResp != null && (
        <RespostasExperienciaModal id={verResp} onFechar={() => setVerResp(null)} />
      )}
    </>
  );
}
