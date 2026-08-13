"use client";

import { useAnaliseBalancete, useLaudoEscrito } from "@/hooks/use-api";
import { useFiltros } from "@/hooks/use-filters";
import { brl, brlCompact, dataBR, mesBR, num } from "@/lib/format";
import type {
  AnaliseBalanceteResp,
  AnaliseDeterministica,
  GrupoPatrimonial,
  Inconsistencia,
  IndicadorCalc,
  LinhaDRE,
} from "@/lib/types";
import clsx from "clsx";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileDown,
  Loader2,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

const SAUDE: Record<
  AnaliseDeterministica["saudeGeral"],
  { rotulo: string; classe: string }
> = {
  forte: { rotulo: "Saúde forte", classe: "bg-good/12 text-good" },
  estavel: { rotulo: "Estável", classe: "bg-ent/12 text-ent" },
  atencao: { rotulo: "Requer atenção", classe: "bg-warning/12 text-warn" },
  critica: { rotulo: "Crítica", classe: "bg-critical/12 text-critical" },
};

const FAIXA: Record<IndicadorCalc["faixa"], string> = {
  bom: "text-good",
  atencao: "text-warn",
  ruim: "text-critical",
  neutro: "text-muted",
};

const SEVERIDADE: Record<Inconsistencia["severidade"], string> = {
  alta: "border-critical/40 bg-critical/8",
  media: "border-warning/40 bg-warning/8",
  baixa: "border-hairline bg-surface-2",
};

function Tendencia({ t }: { t: IndicadorCalc["tendencia"] }) {
  if (t === "melhora") return <TrendingUp className="size-3.5 text-good" />;
  if (t === "piora") return <TrendingDown className="size-3.5 text-critical" />;
  if (t === "estavel") return <Minus className="size-3.5 text-muted" />;
  return null;
}

export default function AnaliseBalancetePage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const q = useAnaliseBalancete(qs, temEmpresa);
  const dados = q.data;

  if (!temEmpresa) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Building2 className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Selecione uma empresa</p>
      </section>
    );
  }

  if (q.isLoading || (q.isFetching && !dados)) {
    return (
      <section className="card grid place-items-center gap-4 px-6 py-20 text-center">
        <Loader2 className="size-6 animate-spin text-ent" />
        <p className="text-sm text-muted">
          Coletando os saldos e aplicando as regras…
        </p>
      </section>
    );
  }

  if (q.isError || !dados) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-critical/12 text-critical">
          <AlertTriangle className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">
          Não foi possível gerar a análise
        </p>
        <p className="max-w-md text-xs text-muted">
          {q.error instanceof Error
            ? q.error.message
            : "Tente novamente em instantes."}
        </p>
      </section>
    );
  }

  return <Laudo dados={dados} qs={qs} temEmpresa={temEmpresa} />;
}

function Laudo({
  dados,
  qs,
  temEmpresa,
}: {
  dados: AnaliseBalanceteResp;
  qs: string;
  temEmpresa: boolean;
}) {
  const { analise, empresa, periodo } = dados;
  const saude = SAUDE[analise.saudeGeral] ?? SAUDE.estavel;

  const [pedirLaudo, setPedirLaudo] = useState(false);
  const laudo = useLaudoEscrito(qs, pedirLaudo && temEmpresa);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            body * { visibility: hidden !important; }
            #laudo-print, #laudo-print * { visibility: visible !important; }
            #laudo-print { position: absolute; inset: 0; padding: 0; }
            .no-print { display: none !important; }
          }`,
        }}
      />

      <section id="laudo-print" className="card anim-fade-up p-6">
        {/* Cabeçalho */}
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-ent">
              <Sparkles className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Análise de Balancete
              </span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-ink">
              {empresa.nome}
            </h1>
            <p className="text-xs text-muted">
              {empresa.cnpj ? `CNPJ ${empresa.cnpj} · ` : ""}
              {dataBR(periodo.inicio)} – {dataBR(periodo.fim)} (
              {periodo.meses.length}{" "}
              {periodo.meses.length === 1 ? "mês" : "meses"})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold",
                saude.classe,
              )}
            >
              {saude.rotulo}
            </span>
            <button
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface"
            >
              <FileDown className="size-3.5" /> Exportar PDF
            </button>
          </div>
        </header>

        {/* Inconsistências / regras */}
        <Regras analise={analise} />

        {/* Indicadores */}
        {analise.indicadores.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Indicadores
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {analise.indicadores.map((ind) => (
                <div
                  key={ind.chave}
                  className="rounded-xl border border-hairline bg-surface-2/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">
                      {ind.nome}
                    </span>
                    <Tendencia t={ind.tendencia} />
                  </div>
                  <p
                    className={clsx(
                      "mt-1 text-lg font-semibold tabular-nums",
                      FAIXA[ind.faixa],
                    )}
                  >
                    {ind.formatado}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted">
                    {ind.interpretacao}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estrutura patrimonial (o balanço que fecha) + DRE do período */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Estrutura analise={analise} />
          <Dre dre={analise.dre} />
        </div>

        {/* Evolução mês a mês: saldo (estoque) e resultado (fluxo) */}
        {analise.meses.length > 1 && <Evolucao analise={analise} />}

        {/* Laudo escrito por IA (opcional) */}
        <div className="mt-6 border-t border-hairline pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Laudo escrito
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Redação gerada por IA sobre a análise acima.
              </p>
            </div>
            {!laudo.data && (
              <button
                onClick={() => setPedirLaudo(true)}
                disabled={laudo.isFetching}
                className="no-print inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {laudo.isFetching ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Gerando…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" /> Gerar laudo escrito
                  </>
                )}
              </button>
            )}
          </div>

          {laudo.data && (
            <div className="mt-3">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
                {laudo.data.texto}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                <CheckCircle2 className="size-3" />
                Redigido por IA ({laudo.data.meta.modelo}) ·{" "}
                {num(
                  laudo.data.meta.tokensEntrada + laudo.data.meta.tokensSaida,
                )}{" "}
                tokens. Confira antes de apresentar.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <footer className="mt-6 flex items-center gap-1.5 border-t border-hairline pt-3 text-[11px] text-muted">
          <CheckCircle2 className="size-3" />
          Regras e indicadores calculados diretamente dos saldos do contábil
          (sem IA).
        </footer>
      </section>
    </>
  );
}

function Regras({ analise }: { analise: AnaliseDeterministica }) {
  const { cobertura: cob } = analise;
  const coberturaParcial =
    cob.mesesComMovimento < cob.mesesSolicitados || !cob.temSaldoInicial;
  const semProblema = analise.inconsistencias.length === 0;

  return (
    <div className="mb-6 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Validação contábil (regras)
      </h2>

      {analise.inconsistencias.map((i, idx) => (
        <div
          key={idx}
          className={clsx(
            "rounded-lg border px-3 py-2",
            SEVERIDADE[i.severidade],
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "text-[10px] font-bold uppercase tracking-wide",
                i.severidade === "alta"
                  ? "text-critical"
                  : i.severidade === "media"
                    ? "text-warn"
                    : "text-muted",
              )}
            >
              {i.severidade}
            </span>
            <p className="text-sm font-medium text-ink">{i.titulo}</p>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-ink-2">{i.detalhe}</p>
        </div>
      ))}

      {semProblema && (
        <div className="flex items-center gap-2 rounded-lg border border-good/25 bg-good/5 px-3 py-2 text-sm text-ink">
          <CheckCircle2 className="size-4 shrink-0 text-good" />
          Nenhuma inconsistência de regra.
        </div>
      )}

      {coberturaParcial && (
        <p className="text-xs text-muted">
          Cobertura: {num(cob.mesesComMovimento)} de {num(cob.mesesSolicitados)}{" "}
          meses com movimento
          {cob.primeiroMesComDado
            ? ` (a partir de ${cob.primeiroMesComDado})`
            : ""}
          .
          {!cob.temSaldoInicial &&
            " Sem saldo antes do período — empresa nova no recorte ou início da escrituração."}
        </p>
      )}
    </div>
  );
}

function LinhaEstrutura({ g }: { g: GrupoPatrimonial | undefined }) {
  if (!g) return null;
  return (
    <tr className="border-b border-hairline/50">
      <td className="px-3 py-2 text-ink-2">{g.nome}</td>
      <td className="px-3 py-2 text-right tabular-nums text-ink">
        {brl(g.saldo)}
      </td>
      <td className="w-14 px-3 py-2 text-right tabular-nums text-muted">
        {g.pctBase != null ? `${(g.pctBase * 100).toFixed(0)}%` : "—"}
      </td>
    </tr>
  );
}

function TotalEstrutura({ nome, valor }: { nome: string; valor: number }) {
  return (
    <tr className="border-t-2 border-hairline bg-surface-2/40 font-semibold">
      <td className="px-3 py-2 text-ink">{nome}</td>
      <td className="px-3 py-2 text-right tabular-nums text-ink">
        {brl(valor)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted">100%</td>
    </tr>
  );
}

/** Balanço patrimonial resumido — Ativo de um lado, Passivo + PL do outro, e fecham. */
function Estrutura({ analise }: { analise: AnaliseDeterministica }) {
  const { estrutura, totais } = analise;
  const por = (chave: GrupoPatrimonial["chave"]) =>
    estrutura.find((g) => g.chave === chave);

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Estrutura patrimonial (último mês)
      </h2>
      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full text-sm">
          <tbody>
            <LinhaEstrutura g={por("ativoCirc")} />
            <LinhaEstrutura g={por("ativoNaoCirc")} />
            <TotalEstrutura nome="Ativo total" valor={totais.ativo} />
            <tr className="h-2" />
            <LinhaEstrutura g={por("passivoCirc")} />
            <LinhaEstrutura g={por("passivoNaoCirc")} />
            <LinhaEstrutura g={por("pl")} />
            <TotalEstrutura
              nome="Passivo + PL"
              valor={totais.passivo + totais.pl}
            />
          </tbody>
        </table>
      </div>
      {Math.abs(totais.resultadoExercicio) > 1 && (
        <p className="mt-2 text-[11px] leading-snug text-muted">
          O PL já inclui o resultado do exercício de{" "}
          <span
            className={
              totais.resultadoExercicio >= 0 ? "text-good" : "text-critical"
            }
          >
            {brl(totais.resultadoExercicio)}
          </span>{" "}
          ainda não transportado às contas de PL (normal antes da apuração).
        </p>
      )}
    </div>
  );
}

/** DRE condensada do período — em FLUXO (movimento do intervalo), não saldo. */
function Dre({ dre }: { dre: LinhaDRE[] }) {
  if (dre.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Resultado do período (DRE)
      </h2>
      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full text-sm">
          <tbody>
            {dre.map((l) => (
              <tr
                key={l.chave}
                className={clsx(
                  "border-b border-hairline/50 last:border-0",
                  l.destaque && "bg-surface-2/40 font-semibold",
                )}
              >
                <td
                  className={clsx(
                    "px-3 py-2",
                    l.destaque ? "text-ink" : "text-ink-2",
                  )}
                >
                  {l.nome}
                </td>
                <td
                  className={clsx(
                    "px-3 py-2 text-right tabular-nums",
                    l.valor < 0 ? "text-critical" : "text-ink",
                  )}
                >
                  {brl(l.valor)}
                </td>
                <td className="w-14 px-3 py-2 text-right tabular-nums text-muted">
                  {l.pctReceita != null
                    ? `${(l.pctReceita * 100).toFixed(0)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        Valores do movimento do período (não o saldo acumulado do ano). % =
        análise vertical sobre a receita líquida.
      </p>
    </div>
  );
}

interface LinhaEvolucao {
  chave: string;
  nome: string;
  serie: number[];
  destaque?: boolean;
}

function TabelaEvolucao({
  titulo,
  meses,
  linhas,
}: {
  titulo: string;
  meses: string[];
  linhas: LinhaEvolucao[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
        {titulo}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-hairline text-muted">
              <th className="px-3 py-2 text-left font-medium">Conta</th>
              {meses.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">
                  {mesBR(m + "-01")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((g) => (
              <tr
                key={g.chave}
                className="border-b border-hairline/50 last:border-0"
              >
                <td
                  className={clsx(
                    "px-3 py-1.5",
                    g.destaque ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {g.nome}
                </td>
                {g.serie.map((v, i) => (
                  <td
                    key={i}
                    className={clsx(
                      "px-2 py-1.5 text-right tabular-nums",
                      v < 0 ? "text-critical" : "text-ink",
                    )}
                  >
                    {brlCompact(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Evolução mês a mês: patrimônio em SALDO (estoque) e resultado em FLUXO (mês). */
function Evolucao({ analise }: { analise: AnaliseDeterministica }) {
  const fluxo = analise.dre.filter((l) =>
    ["receitaLiquida", "custoDespesa", "resultado"].includes(l.chave),
  );

  return (
    <div className="mb-6 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Evolução mês a mês
      </h2>
      <TabelaEvolucao
        titulo="Patrimônio — saldo ao fim do mês"
        meses={analise.meses}
        linhas={analise.estrutura.map((g) => ({
          chave: g.chave,
          nome: g.nome,
          serie: g.serie,
        }))}
      />
      <TabelaEvolucao
        titulo="Resultado — movimento do mês"
        meses={analise.meses}
        linhas={fluxo.map((l) => ({
          chave: l.chave,
          nome: l.nome.replace(/^\([−=]\)\s*/, ""),
          serie: l.serie,
          destaque: l.chave === "resultado",
        }))}
      />
    </div>
  );
}
