"use client";

import { AlertTriangle, CheckCircle2, ClipboardList, Gauge, Send, ShieldCheck, Users } from "lucide-react";
import { Kpi } from "@/components/kpi-conf";
import { EmptyState } from "@/components/ui";
import { CardPendencia } from "@/components/painel-pendencia";
import { usePainelRh } from "@/hooks/use-api";
import { dataBR, num } from "@/lib/format";

export default function PainelRhPage() {
  const res = usePainelRh();
  const dados = res.data;

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível carregar o painel"
        descricao={res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
      />
    );
  }

  if (!dados) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }

  const { pendencias: p, panorama: pan } = dados;

  return (
    <div className="space-y-6">
      {/* Pendências */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Pendências do RH</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CardPendencia
            titulo="Experiências a decidir"
            icone={<ClipboardList className="size-4" />}
            href="/rh/experiencia"
            indisponivel={!p}
            valor={p?.experienciasPendentes ?? 0}
            rotulo="a decidir"
            detalhe={p ? `${num(p.experienciasAtrasadas)} atrasadas` : ""}
            tone={p && p.experienciasAtrasadas > 0 ? "critical" : p && p.experienciasPendentes > 0 ? "warning" : "good"}
          />
          <CardPendencia
            titulo="Denúncias abertas"
            icone={<ShieldCheck className="size-4" />}
            href="/rh/denuncias"
            indisponivel={!p}
            valor={p?.denunciasAbertas ?? 0}
            rotulo="abertas"
            detalhe={p ? `${num(p.denunciasRecebidas)} novas (não abertas)` : ""}
            tone={p && p.denunciasRecebidas > 0 ? "critical" : p && p.denunciasAbertas > 0 ? "warning" : "good"}
          />
          <CardPendencia
            titulo="Avaliação de clima"
            icone={<Gauge className="size-4" />}
            href="/rh/clima"
            indisponivel={!p}
            valor={p?.climaRespostasAbertas ?? 0}
            rotulo="respostas"
            detalhe={
              p
                ? p.climaRodadasAbertas > 0
                  ? `${num(p.climaRodadasAbertas)} rodada(s) aberta(s)`
                  : "nenhuma rodada aberta"
                : ""
            }
            tone="good"
          />
        </div>
      </section>

      {/* Panorama do mês */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">Panorama do mês</h2>
          <span className="text-xs text-muted">
            {dataBR(dados.periodo.inicio)} – {dataBR(dados.periodo.fim)}
          </span>
        </div>
        {pan ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              rotulo="Experiências respondidas"
              icone={<CheckCircle2 className="size-4" />}
              corIcone="bg-good/12 text-good"
              valor={num(pan.experienciasRespondidas)}
              secundario="Avaliações concluídas no mês"
            />
            <Kpi
              rotulo="Denúncias recebidas"
              icone={<ShieldCheck className="size-4" />}
              corIcone="bg-warning/12 text-warning"
              valor={num(pan.denunciasRecebidasMes)}
              secundario="Novos relatos no canal"
            />
            <Kpi
              rotulo="Campanhas enviadas"
              icone={<Send className="size-4" />}
              corIcone="bg-accent/12 text-accent"
              valor={num(pan.campanhasEnviadas)}
              secundario="Formulários disparados"
            />
            <Kpi
              rotulo="Respostas de clima"
              icone={<Users className="size-4" />}
              corIcone="bg-ent/12 text-ent"
              valor={num(pan.respostasClima)}
              secundario="Participações no mês"
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Panorama indisponível agora.</p>
        )}
      </section>
    </div>
  );
}
