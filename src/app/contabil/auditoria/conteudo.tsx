"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronDown,
  Copy,
  FileStack,
  Layers,
  ListChecks,
  PencilLine,
  ScanSearch,
  ShieldCheck,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { Kpi } from "@/components/kpi-conf";
import { useFiltros } from "@/hooks/use-filters";
import { useAuditoria } from "@/hooks/use-api";
import { brl, dataBR } from "@/lib/format";
import type { GrupoAchado, LancamentoAchado, TipoAchado } from "@/lib/types";

const ICONE_TIPO: Record<TipoAchado, LucideIcon> = {
  sintetica: Layers,
  orfa: Unlink,
  sem_historico: PencilLine,
  extemporaneo: CalendarClock,
  manual_controle: PencilLine,
  duplicado: Copy,
};

/** Rótulo legível para o código de 2 letras de `origemlctoctb`. */
const ORIGEM_LABEL: Record<string, string> = {
  FP: "Folha",
  FI: "Fiscal",
  CP: "Contas a pagar",
  CR: "Contas a receber",
  FN: "Financeiro",
  IM: "Patrimônio",
  IP: "Importação",
  CB: "Manual",
  CC: "Cartão",
  CE: "Empréstimos",
  LA: "Lalur",
  AA: "Ajuste anterior",
  XX: "Extemporâneo",
  ZZ: "Zeramento",
};

/** Uma conta do lançamento: número tabular + descrição truncada embaixo. */
function ContaCel({ conta, descr }: { conta: number | null; descr: string | null }) {
  if (conta == null) return <span className="text-muted/40">—</span>;
  return (
    <div className="min-w-0">
      <span className="tabular-nums text-ink">{conta}</span>
      {descr && <p className="truncate text-[11px] text-muted">{descr}</p>}
    </div>
  );
}

function OrigemBadge({ origem }: { origem: string }) {
  const label = ORIGEM_LABEL[origem] ?? origem;
  const manual = ["CB", "IP", "LA", "ZZ", "AA", "XX"].includes(origem);
  return (
    <span
      className={clsx(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
        manual ? "bg-warning/12 text-warning" : "bg-ent/10 text-ent"
      )}
      title={origem}
    >
      {label}
    </span>
  );
}

/** A amostra do grupo — a memória de cálculo, rolando dentro de si mesma. */
function Amostra({ linhas }: { linhas: LancamentoAchado[] }) {
  return (
    <div className="max-h-[26rem] overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-hairline text-left text-xs text-muted">
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-2 py-2 font-medium">Débito</th>
            <th className="px-2 py-2 font-medium">Crédito</th>
            <th className="px-2 py-2 text-right font-medium">Valor</th>
            <th className="px-2 py-2 font-medium">Origem</th>
            <th className="px-4 py-2 font-medium">Quem</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} className="border-b border-hairline/60 align-top last:border-0">
              <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{dataBR(l.data)}</td>
              <td className="px-2 py-2">
                <ContaCel conta={l.contaDeb} descr={l.descrDeb} />
              </td>
              <td className="px-2 py-2">
                <ContaCel conta={l.contaCred} descr={l.descrCred} />
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">
                <span className="tabular-nums text-ink">{brl(l.valor)}</span>
                {l.detalhe && <p className="text-[10px] text-warning">{l.detalhe}</p>}
              </td>
              <td className="px-2 py-2">
                <OrigemBadge origem={l.origem} />
              </td>
              <td className="px-4 py-2">
                <p className="truncate text-xs text-ink">{l.usuario ?? "—"}</p>
                {l.historico && <p className="truncate text-[11px] text-muted" title={l.historico}>{l.historico}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Um card por tipo de achado: cabeçalho com veredito + amostra sanfonada. */
function GrupoCard({ grupo }: { grupo: GrupoAchado }) {
  const [aberto, setAberto] = useState(grupo.severidade === "alta");
  const Icone = ICONE_TIPO[grupo.tipo];
  const alta = grupo.severidade === "alta";
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={clsx(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            alta ? "bg-critical/12 text-critical" : "bg-warning/12 text-warning"
          )}
        >
          <Icone className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-ink">{grupo.titulo}</h3>
            <span
              className={clsx(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                alta ? "bg-critical/12 text-critical" : "bg-warning/12 text-warning"
              )}
            >
              {grupo.contagem} {grupo.contagem === 1 ? "lançamento" : "lançamentos"}
            </span>
          </div>
          <p className="truncate text-xs text-muted">{grupo.criterio}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-sm text-ink">{brl(grupo.valor)}</p>
          <p className="text-[10px] text-muted">soma no período</p>
        </div>
        <ChevronDown
          className={clsx("size-4 shrink-0 text-muted transition-transform", aberto && "rotate-180")}
        />
      </button>
      {aberto && (
        <div className="border-t border-hairline">
          <Amostra linhas={grupo.amostra} />
          {grupo.truncado && (
            <p className="border-t border-hairline px-4 py-2 text-[11px] text-muted">
              Mostrando os {grupo.amostra.length} de maior valor, de {grupo.contagem} no total.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function AuditoriaPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const res = useAuditoria(qs, temEmpresa);
  const dados = res.data;

  if (!temEmpresa) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Building2 className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Selecione uma empresa</p>
        <p className="max-w-md text-xs text-muted">
          A auditoria varre os lançamentos de uma empresa por vez, no período escolhido.
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
        <p className="text-sm font-medium text-ink">Não foi possível rodar a auditoria</p>
        <p className="max-w-md text-xs text-muted">
          {res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
        </p>
      </section>
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Varrendo os lançamentos do período…</p>
      </section>
    );
  }

  const limpo = dados.grupos.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Lançamentos no período"
          icone={<FileStack className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={dados.totalLancamentos.toLocaleString("pt-BR")}
          secundario="Normais (LN) varridos na empresa"
        />
        <Kpi
          rotulo="Achados"
          icone={<ScanSearch className="size-4" />}
          corIcone={limpo ? "bg-ent/12 text-ent" : "bg-warning/12 text-warning"}
          valor={dados.resumo.totalAchados.toLocaleString("pt-BR")}
          secundario="Lançamentos com alguma anomalia"
          alerta={dados.resumo.totalAchados > 0}
        />
        <Kpi
          rotulo="Tipos acionados"
          icone={<ListChecks className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={`${dados.resumo.tiposComAchado} de 6`}
          secundario="Checagens que acenderam"
        />
      </div>

      {limpo ? (
        <section className="card grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
            <ShieldCheck className="size-6" />
          </span>
          <p className="text-sm font-medium text-ink">Nenhuma anomalia encontrada</p>
          <p className="max-w-md text-xs text-muted">
            Os {dados.totalLancamentos.toLocaleString("pt-BR")} lançamentos do período passaram nas
            seis checagens.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {dados.grupos.map((g) => (
            <GrupoCard key={g.tipo} grupo={g} />
          ))}
        </div>
      )}
    </div>
  );
}
