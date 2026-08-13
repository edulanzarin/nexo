"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { useFiltros } from "@/hooks/use-filters";
import { useFechamento } from "@/hooks/use-api";
import { brl } from "@/lib/format";
import type { ChecagemFechamento, StatusFechamento } from "@/lib/types";

/** Aparência de cada status do semáforo: ícone, cor e rótulo. */
const META: Record<
  StatusFechamento,
  { Icone: typeof CheckCircle2; cor: string; chip: string; rotulo: string }
> = {
  ok: { Icone: CheckCircle2, cor: "text-good", chip: "bg-good/12 text-good", rotulo: "Tudo certo" },
  atencao: { Icone: AlertTriangle, cor: "text-warning", chip: "bg-warning/12 text-warning", rotulo: "Confira antes" },
  erro: { Icone: XCircle, cor: "text-critical", chip: "bg-critical/12 text-critical", rotulo: "Pendências" },
  na: { Icone: MinusCircle, cor: "text-muted", chip: "bg-surface-2 text-muted", rotulo: "Sem dados" },
};

/** Veredito geral, em uma frase, conforme o pior status das checagens. */
const VEREDITO: Record<StatusFechamento, string> = {
  ok: "Pode fechar: as conferências do mês não acusaram pendência.",
  atencao: "Dá para fechar, mas confira os pontos amarelos antes.",
  erro: "Ainda não feche: há pendências que travam o mês.",
  na: "Sem movimento suficiente no período para conferir.",
};

function ChecagemCard({ c, qs }: { c: ChecagemFechamento; qs: string }) {
  const meta = META[c.status];
  const href = c.link ? `${c.link}?${qs}&ap=1` : undefined;
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <meta.Icone className={clsx("mt-0.5 size-5 shrink-0", meta.cor)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-ink">{c.titulo}</h3>
            <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium", meta.chip)}>
              {meta.rotulo}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">{c.resumo}</p>

          {c.itens.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {c.itens.map((it, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={clsx(
                        "size-1.5 shrink-0 translate-y-[-1px] rounded-full",
                        it.severidade === "erro"
                          ? "bg-critical"
                          : it.severidade === "atencao"
                            ? "bg-warning"
                            : "bg-good"
                      )}
                    />
                    <span className="text-ink">{it.rotulo}</span>
                  </span>
                  {it.valor != null && Math.abs(it.valor) >= 0.005 && (
                    <span className="shrink-0 tabular-nums text-muted">{brl(Math.abs(it.valor))}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {href && (
            <Link
              href={href}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Abrir {c.titulo.toLowerCase()}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FechamentoPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const fech = useFechamento(qs, temEmpresa);
  const dados = fech.data;

  if (!temEmpresa) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Building2 className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Selecione uma empresa</p>
        <p className="max-w-md text-xs text-muted">
          O fechamento roda as conferências do mês para uma empresa de cada vez.
        </p>
      </section>
    );
  }

  if (fech.isError) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-critical/12 text-critical">
          <AlertTriangle className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Não foi possível montar o fechamento</p>
        <p className="max-w-md text-xs text-muted">
          {fech.error instanceof Error ? fech.error.message : "Tente novamente em instantes."}
        </p>
      </section>
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Rodando as conferências do mês…</p>
      </section>
    );
  }

  const meta = META[dados.status];

  return (
    <div className="space-y-4">
      {/* Veredito geral: o semáforo do mês. */}
      <section className={clsx("card flex items-start gap-4 p-5", "border-l-4", {
        "border-l-good": dados.status === "ok",
        "border-l-warning": dados.status === "atencao",
        "border-l-critical": dados.status === "erro",
        "border-l-hairline": dados.status === "na",
      })}>
        <meta.Icone className={clsx("mt-0.5 size-8 shrink-0", meta.cor)} />
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{VEREDITO[dados.status]}</p>
          <p className="mt-0.5 text-xs text-muted">
            {dados.empresa.nome || `Empresa ${dados.empresa.codigo}`}
          </p>
        </div>
      </section>

      {/* Uma checagem por card. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dados.checagens.map((c) => (
          <ChecagemCard key={c.id} c={c} qs={qs} />
        ))}
      </div>
    </div>
  );
}
