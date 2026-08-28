"use client";

import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  FileSpreadsheet,
  Import,
  Landmark,
  ListChecks,
  ScanSearch,
  Table2,
} from "lucide-react";
import { Kpi } from "@/components/kpi-conf";
import { Card, EmptyState } from "@/components/ui";
import { usePainelContabil } from "@/hooks/use-api";
import { dataBR, dataHoraBR, num } from "@/lib/format";

/**
 * Painel do COLABORADOR: os SEUS números do mês. Mesmos contadores da trilha do
 * painel de gestão, recortados por dono no servidor — aqui não há série do time
 * nem nome de outra pessoa. Quem precisa do time todo tem a seção `painel-gestao`.
 */

/** acao da trilha → rótulo legível no feed. */
const ROTULO_ACAO: Record<string, string> = {
  "contabil.conciliacao.gerar": "Conciliação gerada",
  "contabil.implantacao.gerar": "Implantação gerada",
  "contabil.laudo.gerar": "Laudo gerado",
  "contabil.pendencia.triar": "Pendência triada",
  "contabil.export": "Exportação",
};

export default function PainelContabilPage() {
  const res = usePainelContabil();
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }

  const { atividade, base, recentes } = dados;

  return (
    <div className="space-y-6">
      {/* O que EU rodei no mês */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">O que você rodou no mês</h2>
          <span className="text-xs text-muted">
            {dataBR(dados.periodo.inicio)} – {dataBR(dados.periodo.fim)}
          </span>
        </div>
        {atividade ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              rotulo="Conciliações geradas"
              icone={<Landmark className="size-4" />}
              corIcone="bg-accent/12 text-accent"
              valor={num(atividade.conciliacoes)}
              secundario={`${num(atividade.conciliacaoLinhas)} lançamentos gerados`}
            />
            <Kpi
              rotulo="Implantações geradas"
              icone={<Import className="size-4" />}
              corIcone="bg-good/12 text-good"
              valor={num(atividade.implantacoes)}
              secundario="Arquivos de saldo gerados"
            />
            <Kpi
              rotulo="Laudos gerados"
              icone={<FileSpreadsheet className="size-4" />}
              corIcone="bg-ent/12 text-ent"
              valor={num(atividade.laudos)}
              secundario="Análises de balancete"
            />
            <Kpi
              rotulo="Pendências triadas"
              icone={<ListChecks className="size-4" />}
              corIcone="bg-warning/12 text-warning"
              valor={num(atividade.pendenciasTriadas)}
              secundario={`${num(atividade.pendenciasResolvidas)} resolvidas · ${num(atividade.pendenciasIgnoradas)} ignoradas`}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Atividade indisponível agora.</p>
        )}
      </section>

      {/* Base configurada — o cadastro que sustenta o trabalho de todo mundo */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Base configurada</h2>
        {base ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              rotulo="Plano de contabilização"
              icone={<Table2 className="size-4" />}
              corIcone="bg-ent/12 text-ent"
              valor={num(base.plano)}
              secundario="CFOPs com regra"
            />
            <Kpi
              rotulo="Regras de extrato"
              icone={<ScanSearch className="size-4" />}
              corIcone="bg-accent/12 text-accent"
              valor={num(base.regrasExtrato)}
              secundario="Contrapartidas do extrato"
            />
            <Kpi
              rotulo="Contas de banco"
              icone={<Banknote className="size-4" />}
              corIcone="bg-good/12 text-good"
              valor={num(base.contasBanco)}
              secundario="Contas mapeadas"
            />
            <Kpi
              rotulo="De-para de implantação"
              icone={<ClipboardCheck className="size-4" />}
              corIcone="bg-warning/12 text-warning"
              valor={num(base.depara)}
              secundario="Contas casadas"
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Base indisponível agora.</p>
        )}
      </section>

      {/* Feed só dos MEUS eventos: sem coluna de autor, seria sempre o mesmo nome */}
      <Card as="section" overflow padding="none">
        <div className="border-b border-hairline px-4 py-3">
          <h3 className="text-sm font-medium text-ink">Sua atividade recente</h3>
        </div>
        {recentes == null ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Indisponível agora.</p>
        ) : recentes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Você ainda não rodou nada por aqui.
          </p>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {recentes.map((e) => (
              <li key={e.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">{ROTULO_ACAO[e.acao] ?? e.acao}</span>
                  <span className="shrink-0 text-[11px] text-muted">{dataHoraBR(e.quando)}</span>
                </div>
                {e.alvo && (
                  <p className="truncate text-[11px] text-muted" title={e.alvo}>
                    {e.alvo}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
