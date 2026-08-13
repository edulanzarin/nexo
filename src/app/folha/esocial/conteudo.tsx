"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Send,
  UserMinus,
  UserPlus,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { Kpi } from "@/components/kpi-conf";
import { useFiltros } from "@/hooks/use-filters";
import { useConformidadeEsocial } from "@/hooks/use-api";
import { dataBR, num } from "@/lib/format";
import type { EventoEsocial, PendenciaEsocial } from "@/lib/types";

/** Badge da situação de uma pendência. */
function SituacaoBadge({ situacao }: { situacao: PendenciaEsocial["situacao"] }) {
  const nao = situacao === "nao_enviado";
  return (
    <span
      className={clsx(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
        nao ? "bg-critical/12 text-critical" : "bg-warning/15 text-warning"
      )}
    >
      {nao ? "não enviado" : "sem recibo"}
    </span>
  );
}

/** Lista de pendências obrigatórias (admissões ou rescisões sem aceite). */
function PendenciaLista({
  titulo,
  subtitulo,
  icone,
  dados,
}: {
  titulo: string;
  subtitulo: string;
  icone: React.ReactNode;
  dados: PendenciaEsocial[];
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <span
          className={clsx(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            dados.length > 0 ? "bg-warning/12 text-warning" : "bg-good/12 text-good"
          )}
        >
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-ink">{titulo}</h2>
          <p className="truncate text-xs text-muted">{subtitulo}</p>
        </div>
        <span
          className={clsx(
            "shrink-0 rounded px-2 py-0.5 text-xs font-medium tabular-nums",
            dados.length > 0 ? "bg-warning/15 text-warning" : "bg-good/12 text-good"
          )}
        >
          {dados.length}
        </span>
      </header>
      {dados.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted">Tudo transmitido e aceito.</p>
      ) : (
        <div className="max-h-[22rem] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {dados.map((d) => (
                <tr key={d.contrato} className="border-b border-hairline/60 last:border-0">
                  <td className="px-4 py-2">
                    <span className="text-ink">{d.funcionario}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{dataBR(d.data)}</td>
                  <td className="px-4 py-2 text-right">
                    <SituacaoBadge situacao={d.situacao} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Barra de proporção aceito/pendente/rejeitado de um evento. */
function BarraEvento({ e }: { e: EventoEsocial }) {
  const t = Math.max(1, e.total);
  const seg = (n: number, cor: string) =>
    n > 0 ? <div className={cor} style={{ width: `${(n / t) * 100}%` }} /> : null;
  return (
    <div className="flex h-1.5 overflow-hidden rounded bg-surface-2">
      {seg(e.aceitos, "bg-good")}
      {seg(e.pendentes, "bg-warning")}
      {seg(e.rejeitados, "bg-critical")}
    </div>
  );
}

export default function EsocialPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const res = useConformidadeEsocial(qs, temEmpresa);
  const dados = res.data;

  if (!temEmpresa) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Building2 className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Selecione uma empresa</p>
        <p className="max-w-md text-xs text-muted">
          A conformidade eSocial é verificada de uma empresa por vez, no período escolhido.
        </p>
      </section>
    );
  }

  if (res.isError) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-critical/12 text-critical">
          <AlertTriangle className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Não foi possível verificar o eSocial</p>
        <p className="max-w-md text-xs text-muted">
          {res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
        </p>
      </section>
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Conferindo as transmissões do eSocial…</p>
      </section>
    );
  }

  const { resumo } = dados;
  const semNada = resumo.total === 0 && dados.admissoesPendentes.length === 0 && dados.rescisoesPendentes.length === 0;

  if (semNada) {
    return (
      <section className="card grid place-items-center px-6 py-14 text-center">
        <p className="text-sm text-muted">Sem eventos de eSocial no período para esta empresa.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Eventos no período"
          icone={<Send className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={num(resumo.total)}
          secundario="Transmissões ao eSocial"
        />
        <Kpi
          rotulo="Aceitos"
          icone={<CheckCircle2 className="size-4" />}
          corIcone="bg-good/12 text-good"
          valor={num(resumo.aceitos)}
          secundario="Com recibo do governo"
        />
        <Kpi
          rotulo="Pendentes"
          icone={<Clock className="size-4" />}
          corIcone="bg-warning/12 text-warning"
          valor={num(resumo.pendentes)}
          secundario="Enviados sem recibo"
          alerta={resumo.pendentes > 0}
        />
        <Kpi
          rotulo="Rejeitados"
          icone={<XCircle className="size-4" />}
          corIcone="bg-critical/12 text-critical"
          valor={num(resumo.rejeitados)}
          secundario="Erro na transmissão"
          alerta={resumo.rejeitados > 0}
        />
      </div>

      {/* Pendências obrigatórias — o que o DP precisa resolver */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PendenciaLista
          titulo="Admissões sem eSocial"
          subtitulo="Admitidos no período sem S-2200 aceito"
          icone={<UserPlus className="size-4" />}
          dados={dados.admissoesPendentes}
        />
        <PendenciaLista
          titulo="Rescisões sem eSocial"
          subtitulo="Desligados no período sem S-2299 aceito"
          icone={<UserMinus className="size-4" />}
          dados={dados.rescisoesPendentes}
        />
      </div>

      {/* Panorama por tipo de evento */}
      <section className="card overflow-hidden">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold">Por tipo de evento</h2>
          <p className="text-xs text-muted">Volume transmitido no período e o resultado de cada um</p>
        </header>
        {dados.eventos.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted">Nenhum evento no período.</p>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Evento</th>
                  <th className="px-2 py-2 text-right font-medium">Aceitos</th>
                  <th className="px-2 py-2 text-right font-medium">Pendentes</th>
                  <th className="px-2 py-2 text-right font-medium">Rejeitados</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {dados.eventos.map((e) => (
                  <tr key={e.evento} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="tabular-nums text-xs text-muted">{e.evento}</span>
                        <span className="truncate text-ink">{e.descricao}</span>
                      </div>
                      <div className="mt-1.5 max-w-[16rem]">
                        <BarraEvento e={e} />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right align-top tabular-nums text-good">
                      {e.aceitos > 0 ? num(e.aceitos) : <span className="text-muted/40">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right align-top tabular-nums">
                      <span className={e.pendentes > 0 ? "text-warning" : "text-muted/40"}>
                        {e.pendentes > 0 ? num(e.pendentes) : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right align-top tabular-nums">
                      <span className={e.rejeitados > 0 ? "text-critical" : "text-muted/40"}>
                        {e.rejeitados > 0 ? num(e.rejeitados) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right align-top tabular-nums text-ink">{num(e.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
