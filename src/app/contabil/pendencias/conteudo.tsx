"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  ClipboardCheck,
  ListChecks,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { Kpi } from "@/components/kpi-conf";
import { Card, EmptyState } from "@/components/ui";
import { NotaDetalheModal } from "@/components/nota-detalhe-modal";
import { useFiltros } from "@/hooks/use-filters";
import { usePendencias, useTriarPendencia } from "@/hooks/use-api";
import { brl, dataBR } from "@/lib/format";
import type { Pendencia } from "@/lib/types";

type Aba = "abertas" | "tratadas" | "todas";

const FONTE_META = {
  conferencia: { rotulo: "Conferência", Icone: ClipboardCheck, cor: "bg-ent/12 text-ent" },
  auditoria: { rotulo: "Auditoria", Icone: ScanSearch, cor: "bg-sai/12 text-sai" },
} as const;

/** Teto de linhas renderizadas — a fila pode ter milhares num mês ruim. */
const MAX_LINHAS = 400;

/** Referência estável para "sem itens" — não recria o array a cada render. */
const VAZIO: Pendencia[] = [];

const idDe = (p: Pendencia) => `${p.fonte}|${p.chave}|${p.tipo}`;

/** Detalhe inline de um lançamento anômalo (fonte Auditoria). */
function DetalheLancamento({ p }: { p: Pendencia }) {
  const l = p.lancamento;
  if (!l) return null;
  return (
    <div className="grid gap-x-6 gap-y-2 border-t border-hairline bg-surface-2/40 px-4 py-3 text-xs sm:grid-cols-2">
      <div>
        <span className="text-muted">Débito </span>
        <span className="tabular-nums text-ink">{l.contaDeb ?? "—"}</span>
        {l.descrDeb && <span className="text-muted"> · {l.descrDeb}</span>}
      </div>
      <div>
        <span className="text-muted">Crédito </span>
        <span className="tabular-nums text-ink">{l.contaCred ?? "—"}</span>
        {l.descrCred && <span className="text-muted"> · {l.descrCred}</span>}
      </div>
      <div>
        <span className="text-muted">Origem </span>
        <span className="text-ink">{l.origem || "—"}</span>
        {l.lancadoEm && <span className="text-muted"> · lançado em {l.lancadoEm}</span>}
      </div>
      <div className="truncate">
        <span className="text-muted">Histórico </span>
        <span className="text-ink" title={l.historico ?? ""}>
          {l.historico ?? "—"}
        </span>
      </div>
      {l.usuario && (
        <div>
          <span className="text-muted">Quem </span>
          <span className="text-ink">{l.usuario}</span>
        </div>
      )}
    </div>
  );
}

function LinhaPendencia({
  p,
  salvando,
  onAbrir,
  onTriar,
}: {
  p: Pendencia;
  salvando: boolean;
  onAbrir: () => void;
  onTriar: (status: "resolvido" | "ignorado" | "reabrir") => void;
}) {
  const fonte = FONTE_META[p.fonte];
  const alta = p.severidade === "alta";
  const triada = p.triagem;

  return (
    <div className={clsx("border-b border-hairline/60 last:border-0", triada && "opacity-70")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={clsx(
            "size-2 shrink-0 rounded-full",
            alta ? "bg-critical" : "bg-warning"
          )}
          title={alta ? "Severidade alta" : "Severidade média"}
        />
        <button
          type="button"
          onClick={onAbrir}
          className="min-w-0 flex-1 text-left"
          title="Ver detalhe"
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{p.titulo}</span>
            <span
              className={clsx(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                fonte.cor
              )}
            >
              {fonte.rotulo}
            </span>
          </div>
          <p className="truncate text-xs text-muted">
            {p.descricao}
            {p.data && <span className="text-muted/70"> · {dataBR(p.data)}</span>}
          </p>
        </button>

        <span className="shrink-0 tabular-nums text-sm text-ink">{brl(p.valor)}</span>

        <div className="flex shrink-0 items-center gap-1">
          {triada ? (
            <button
              type="button"
              disabled={salvando}
              onClick={() => onTriar("reabrir")}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              title={`${triada.status === "resolvido" ? "Resolvida" : "Ignorada"} por ${triada.usuario} em ${triada.em.replace("T", " ")}`}
            >
              <RotateCcw className="size-3.5" />
              Reabrir
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={salvando}
                onClick={() => onTriar("resolvido")}
                className="flex items-center gap-1 rounded-md bg-good/12 px-2 py-1 text-xs font-medium text-good transition-colors hover:bg-good/20 disabled:opacity-50"
              >
                <Check className="size-3.5" />
                Resolver
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => onTriar("ignorado")}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              >
                <X className="size-3.5" />
                Ignorar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PendenciasPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const empresa = filtros.empresas[0];
  const res = usePendencias(qs, temEmpresa);
  const triar = useTriarPendencia();
  const dados = res.data;

  const [aba, setAba] = useState<Aba>("abertas");
  const [salvando, setSalvando] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(null);
  const [notaAberta, setNotaAberta] = useState<{ p: Pendencia } | null>(null);

  const itens = dados?.itens ?? VAZIO;
  const filtrados = useMemo(() => {
    if (aba === "abertas") return itens.filter((i) => !i.triagem);
    if (aba === "tratadas") return itens.filter((i) => i.triagem);
    return itens;
  }, [itens, aba]);
  const visiveis = filtrados.slice(0, MAX_LINHAS);

  async function acao(p: Pendencia, status: "resolvido" | "ignorado" | "reabrir") {
    const k = idDe(p);
    setSalvando((s) => new Set(s).add(k));
    try {
      await triar({
        empresa,
        fonte: p.fonte,
        chave: p.chave,
        tipo: p.tipo,
        status,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar a triagem");
    } finally {
      setSalvando((s) => {
        const n = new Set(s);
        n.delete(k);
        return n;
      });
    }
  }

  function abrir(p: Pendencia) {
    if (p.fonte === "conferencia" && p.nota) {
      setNotaAberta({ p });
    } else {
      const k = idDe(p);
      setExpandido((cur) => (cur === k ? null : k));
    }
  }

  if (!temEmpresa) {
    return <EmptyState icon={<Building2 className="size-6" />} titulo="Selecione uma empresa" />;
  }

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível montar a fila"
        descricao={res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
      />
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Reunindo Conferência e Auditoria do período…</p>
      </section>
    );
  }

  const { resumo } = dados;
  const semNada = itens.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Abertas"
          icone={<ListChecks className="size-4" />}
          corIcone={resumo.abertas > 0 ? "bg-warning/12 text-warning" : "bg-good/12 text-good"}
          valor={resumo.abertas.toLocaleString("pt-BR")}
          secundario={`${resumo.alta.toLocaleString("pt-BR")} de severidade alta`}
          alerta={resumo.alta > 0}
        />
        <Kpi
          rotulo="Valor em aberto"
          icone={<AlertTriangle className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={brl(resumo.valorAberto)}
          secundario="Soma das pendências não tratadas"
        />
        <Kpi
          rotulo="Tratadas"
          icone={<Check className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={resumo.tratadas.toLocaleString("pt-BR")}
          secundario="Resolvidas ou ignoradas"
        />
      </div>

      {semNada ? (
        <EmptyState
          icon={<ShieldCheck className="size-6" />}
          titulo="Nada pendente no período"
          descricao="Conferência e Auditoria não acharam nenhuma exceção nesta empresa e período."
        />
      ) : (
        <Card as="section" overflow padding="none" animate="none">
          <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-3 py-2">
            {(
              [
                ["abertas", `Abertas (${resumo.abertas})`],
                ["tratadas", `Tratadas (${resumo.tratadas})`],
                ["todas", `Todas (${resumo.total})`],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  aba === id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {visiveis.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              Nenhuma pendência {aba === "abertas" ? "aberta" : "tratada"} no período.
            </p>
          ) : (
            <div className="max-h-[62vh] overflow-y-auto">
              {visiveis.map((p) => {
                const k = idDe(p);
                return (
                  <div key={k}>
                    <LinhaPendencia
                      p={p}
                      salvando={salvando.has(k)}
                      onAbrir={() => abrir(p)}
                      onTriar={(status) => acao(p, status)}
                    />
                    {expandido === k && p.fonte === "auditoria" && <DetalheLancamento p={p} />}
                  </div>
                );
              })}
            </div>
          )}

          {filtrados.length > MAX_LINHAS && (
            <p className="border-t border-hairline px-4 py-2 text-[11px] text-muted">
              Mostrando {MAX_LINHAS.toLocaleString("pt-BR")} de{" "}
              {filtrados.length.toLocaleString("pt-BR")}
            </p>
          )}
        </Card>
      )}

      {notaAberta?.p.nota && (
        <NotaDetalheModal
          nota={notaAberta.p.nota}
          tipo={notaAberta.p.lado ?? "ent"}
          empresa={empresa}
          onFechar={() => setNotaAberta(null)}
        />
      )}
    </div>
  );
}
