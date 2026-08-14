"use client";

import Link from "next/link";
import { AlertTriangle, HandCoins, Plane, ShieldCheck } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { CardPendencia } from "@/components/painel-pendencia";
import { usePainelColaborador } from "@/hooks/use-api";
import { dataBR, num } from "@/lib/format";
import { linkEsocial, linkFerias, linkRescisoes } from "@/lib/painel-links";
import type { PainelFeriasCritica, PainelRescisaoUrgente } from "@/lib/painel-dp-tipos";

/** Prazo em texto, com cor pela urgência (vencida / a vencer). */
function prazoTxt(dias: number | null) {
  if (dias == null) return <span className="text-muted">—</span>;
  if (dias < 0) return <span className="font-medium text-critical">vencida há {num(-dias)}d</span>;
  if (dias === 0) return <span className="font-medium text-critical">vence hoje</span>;
  return <span className={dias <= 3 ? "text-warning" : "text-muted"}>faltam {num(dias)}d</span>;
}

/** Uma linha de item priorizado: nome + empresa à esquerda, prazo à direita. */
function LinhaItem({
  href,
  funcionario,
  empresa,
  direita,
}: {
  href: string;
  funcionario: string;
  empresa: string;
  direita: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
    >
      <div className="min-w-0">
        <div className="truncate text-sm text-ink" title={funcionario}>
          {funcionario}
        </div>
        <div className="truncate text-[11px] text-muted" title={empresa}>
          {empresa}
        </div>
      </div>
      <div className="shrink-0 whitespace-nowrap text-xs">{direita}</div>
    </Link>
  );
}

/** Card com um cabeçalho e uma lista (ou vazio) de itens priorizados. */
function ListaCard({
  titulo,
  href,
  vazio,
  indisponivel,
  temItens,
  children,
}: {
  titulo: string;
  href: string;
  vazio: string;
  indisponivel: boolean;
  temItens: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card as="section" overflow padding="none" className="h-full">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <h3 className="text-sm font-medium text-ink">{titulo}</h3>
        <Link href={href} className="text-xs text-muted transition-colors hover:text-ink">
          ver todas
        </Link>
      </div>
      {indisponivel ? (
        <p className="px-4 py-10 text-center text-sm text-muted">Indisponível agora.</p>
      ) : temItens ? (
        <div className="divide-y divide-hairline/60">{children}</div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted">{vazio}</p>
      )}
    </Card>
  );
}

export default function PainelColaboradorPage() {
  const res = usePainelColaborador();
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

  const { rescisoes, ferias, esocial, rescisoesUrgentes, feriasCriticas } = dados;
  const urgentes: PainelRescisaoUrgente[] = rescisoesUrgentes ?? [];
  const criticas: PainelFeriasCritica[] = feriasCriticas ?? [];
  const hoje = dados.periodo.fim;

  return (
    <div className="space-y-6">
      {/* Pendências — a fila do DP */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Pendências do DP</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CardPendencia
            titulo="Rescisões a pagar"
            icone={<HandCoins className="size-4" />}
            href={linkRescisoes(hoje)}
            indisponivel={!rescisoes}
            valor={rescisoes?.pendentes ?? 0}
            rotulo="pendentes"
            detalhe={rescisoes ? `${num(rescisoes.vencidas)} vencidas · ${num(rescisoes.venceBreve)} vencem em breve` : ""}
            tone={rescisoes && rescisoes.vencidas > 0 ? "critical" : rescisoes && rescisoes.pendentes > 0 ? "warning" : "good"}
          />
          <CardPendencia
            titulo="Férias vencidas"
            icone={<Plane className="size-4" />}
            href={linkFerias(hoje)}
            indisponivel={!ferias}
            valor={ferias?.vencidas ?? 0}
            rotulo="funcionários"
            detalhe={ferias ? `${num(ferias.aVencer)} a vencer (120 dias)` : ""}
            tone={ferias && ferias.vencidas > 0 ? "critical" : ferias && ferias.aVencer > 0 ? "warning" : "good"}
          />
          <CardPendencia
            titulo="eSocial rejeitado"
            icone={<ShieldCheck className="size-4" />}
            href={linkEsocial(hoje)}
            indisponivel={!esocial}
            valor={esocial?.rejeitados ?? 0}
            rotulo="rejeitadas (90d)"
            detalhe={esocial ? `${num(esocial.pendentes)} pendentes de recibo` : ""}
            tone={esocial && esocial.rejeitados > 0 ? "critical" : esocial && esocial.pendentes > 0 ? "warning" : "good"}
          />
        </div>
      </section>

      {/* Ações prioritárias — os itens mais urgentes, prontos pra atacar */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Ações prioritárias</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListaCard
            titulo="Rescisões mais urgentes"
            href={linkRescisoes(hoje)}
            vazio="Nenhuma rescisão pendente. 👍"
            indisponivel={rescisoesUrgentes == null}
            temItens={urgentes.length > 0}
          >
            {urgentes.map((i) => (
              <LinhaItem
                key={`${i.codigoempresa}:${i.contrato}`}
                href={linkRescisoes(hoje, i.codigoempresa)}
                funcionario={i.funcionario}
                empresa={`${i.empresa} · prazo ${dataBR(i.prazo)}`}
                direita={prazoTxt(i.diasParaPrazo)}
              />
            ))}
          </ListaCard>

          <ListaCard
            titulo="Férias mais críticas"
            href={linkFerias(hoje)}
            vazio="Ninguém com férias vencidas. 👍"
            indisponivel={feriasCriticas == null}
            temItens={criticas.length > 0}
          >
            {criticas.map((i) => (
              <LinhaItem
                key={`${i.codigoempresa}:${i.contrato}`}
                href={linkFerias(hoje, i.codigoempresa)}
                funcionario={i.funcionario}
                empresa={i.empresa}
                direita={
                  <span className="font-medium text-critical">
                    {i.periodosVencidos > 1 ? `${num(i.periodosVencidos)} períodos · ` : ""}
                    vencida há {num(-i.diasParaLimite)}d
                  </span>
                }
              />
            ))}
          </ListaCard>
        </div>
      </section>
    </div>
  );
}
