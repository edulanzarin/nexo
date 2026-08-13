"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Download, FileUp, HelpCircle, Pencil } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { ContaDropdown } from "@/components/conta-dropdown";
import { HistoricoDropdown } from "@/components/historico-dropdown";
import { useFiltros } from "@/hooks/use-filters";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { brl } from "@/lib/format";
import type { LinhaCasada, StatusCasamento } from "@/lib/implantacao-tipos";

const BADGE: Record<StatusCasamento, { rotulo: string; cor: string; icone: typeof CheckCircle2 }> = {
  casada: { rotulo: "Casada", cor: "bg-good/12 text-good", icone: CheckCircle2 },
  duvidosa: { rotulo: "Confira", cor: "bg-warn/12 text-warn", icone: HelpCircle },
  sem_conta: { rotulo: "Sem conta", cor: "bg-critical/12 text-critical", icone: AlertTriangle },
};

// Mesma pegada de input das outras telas (usuario-form etc.), na altura h-9 dos
// controles de barra para alinhar com os dropdowns.
const campoInput =
  "h-9 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falha na operação");
  return data as T;
}

export default function Conteudo() {
  const { filtros } = useFiltros();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  // Estado da seção (sobrevive à navegação dentro da seção). O PDF é lido pelos
  // controles da barra (ImplantacaoControles), que gravam `casadas` aqui.
  const [casadas, setCasadas] = useEstadoSecao<LinhaCasada[] | null>("casadas", null);
  const [estab, setEstab] = useEstadoSecao<string>("estab", "1");
  const [data, setData] = useEstadoSecao<string>("data", "");
  const [contaImpl, setContaImpl] = useEstadoSecao<number | null>("contaImpl", null);
  // Histórico 350 = "Valor Referente [DICTEXTO]" — o padrão de implantação usado
  // aqui. Já vem preenchido (mudável). Tem [DIC...], então pede complemento.
  const [historico, setHistorico] = useEstadoSecao<number | null>("historico", 350);
  // O histórico escolhido pede complemento? (descrição com marcador [DIC...]). O
  // 350 pede, então já começa true — o campo de complemento vem aberto.
  const [pedeCompl, setPedeCompl] = useEstadoSecao<boolean>("pedeCompl", true);
  const [complemento, setComplemento] = useEstadoSecao<string>("complemento", "IMPLANTACAO DE SALDOS");

  const [editando, setEditando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Filtro por situação: clicar num KPI mostra só aquelas linhas (null = todas).
  const [filtroStatus, setFiltroStatus] = useState<StatusCasamento | null>(null);

  const resumo = useMemo(() => {
    const c = casadas ?? [];
    let deb = 0;
    let cred = 0;
    for (const x of c) {
      if (x.natureza === "D") deb += x.origem.saldo;
      else if (x.natureza === "C") cred += x.origem.saldo;
    }
    const semConta = c.filter((x) => x.status === "sem_conta").length;
    return {
      total: c.length,
      casadas: c.filter((x) => x.status === "casada").length,
      duvidosas: c.filter((x) => x.status === "duvidosa").length,
      semConta,
      deb,
      cred,
      // Fecha só quando tudo tem conta (senão falta natureza de alguém).
      fecha: semConta === 0 && Math.abs(deb - cred) < 1,
    };
  }, [casadas]);

  async function escolherConta(idx: number, conta: number | null) {
    if (!casadas) return;
    const linha = casadas[idx];
    // Natureza da linha decide o lado (débito/crédito). Da origem quando marcada
    // (Patrimonium), senão da conta escolhida no Questor (Systemar não marca D/C).
    let natureza = linha.origem.natureza ?? null;
    if (conta != null && !natureza) {
      try {
        const res = await fetch(`/api/contabil/contas?empresa=${empresa}&busca=${conta}`);
        if (res.ok) {
          const contas = (await res.json()) as { conta: number; natureza?: "D" | "C" }[];
          natureza = contas.find((x) => x.conta === conta)?.natureza ?? null;
        }
      } catch {
        /* natureza fica nula; o servidor resolve ao gerar */
      }
    }
    const nova = [...casadas];
    nova[idx] = {
      ...linha,
      conta,
      status: conta == null ? "sem_conta" : "casada",
      via: conta == null ? null : "manual",
      confianca: conta == null ? 0 : 1,
      natureza,
    };
    setCasadas(nova);
    setEditando(null);
    try {
      await postJson("/api/contabil/implantacao/depara", {
        empresa,
        chave: linha.origem.chave,
        descr: linha.origem.descricao,
        conta,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar de-para");
    }
  }

  async function gerar() {
    if (!casadas) return;
    setOcupado(true);
    try {
      const r = await postJson<{
        arquivo: string;
        linhas: number;
        totalDebito: number;
        totalCredito: number;
        transitoriaZera: boolean;
        semConta: unknown[];
      }>("/api/contabil/implantacao/gerar", {
        empresa,
        estab: Number(estab),
        data,
        contaImplantacao: contaImpl,
        codigoHistorico: historico,
        // Histórico que não pede complemento não leva texto livre.
        complemento: pedeCompl ? complemento : "",
        linhas: casadas.map((c) => c.origem),
      });
      const blob = new Blob([r.arquivo], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `implantacao_${empresa}_${data}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      if (!r.transitoriaZera) {
        toast.warning(
          `Gerado, mas a transitória não zerou (deb ${brl(r.totalDebito)} × cred ${brl(r.totalCredito)}) — o balancete não fecha`
        );
      } else {
        toast.success(`${r.linhas} lançamentos gerados`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar");
    } finally {
      setOcupado(false);
    }
  }

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

  const podeGerar =
    !!casadas?.length && !!data && contaImpl != null && historico != null && resumo.semConta === 0;

  return (
    <div className="grid gap-4">
      {/* Parâmetros do lote: preenchidos ANTES de ler o balancete, então gerar
          já sai com tudo pronto. */}
      <section className="card grid gap-3 p-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <Campo rotulo="Filial">
            <input
              value={estab}
              onChange={(e) => setEstab(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className={clsx(campoInput, "w-14 px-2 text-center")}
            />
          </Campo>
          <Campo rotulo="Data dos lançamentos">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={clsx(campoInput, "w-40", !data && "border-critical/60")}
            />
          </Campo>
          <Campo rotulo="Conta transitória (contrapartida)">
            <ContaDropdown empresa={empresa} valor={contaImpl} onMudar={setContaImpl} limpavel />
          </Campo>
          <Campo rotulo="Histórico">
            <HistoricoDropdown
              valor={historico}
              onMudar={(h) => {
                setHistorico(h?.codigo ?? null);
                setPedeCompl(h?.pedeComplemento ?? true);
              }}
            />
          </Campo>
          {pedeCompl && (
            <Campo rotulo="Complemento do histórico" className="min-w-[14rem] flex-1">
              <input
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className={clsx(campoInput, "w-full")}
              />
            </Campo>
          )}
        </div>
      </section>

      {!casadas ? (
        <section className="card grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
            <FileUp className="size-6" />
          </span>
          <p className="text-sm font-medium text-ink">Nenhum balancete lido</p>
        </section>
      ) : (
        <>
          {/* Resumo do de-para — cada card filtra a tabela pela situação. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              rotulo="Contas"
              valor={resumo.total}
              cor="text-ink"
              ativo={filtroStatus === null}
              onClick={() => setFiltroStatus(null)}
            />
            <Kpi
              rotulo="Casadas"
              valor={resumo.casadas}
              cor="text-good"
              ativo={filtroStatus === "casada"}
              onClick={() => setFiltroStatus((s) => (s === "casada" ? null : "casada"))}
            />
            <Kpi
              rotulo="Confira"
              valor={resumo.duvidosas}
              cor="text-warn"
              ativo={filtroStatus === "duvidosa"}
              onClick={() => setFiltroStatus((s) => (s === "duvidosa" ? null : "duvidosa"))}
            />
            <Kpi
              rotulo="Sem conta"
              valor={resumo.semConta}
              cor="text-critical"
              ativo={filtroStatus === "sem_conta"}
              onClick={() => setFiltroStatus((s) => (s === "sem_conta" ? null : "sem_conta"))}
            />
          </div>

          {/* Prévia do arquivo de importação: uma linha por lançamento, com as
              colunas do arquivo (débito, crédito, histórico, complemento, valor). */}
          <section className="card overflow-hidden">
            <div className="max-h-[calc(100vh-19rem)] overflow-auto">
              <table className="w-full min-w-[48rem] border-collapse text-left text-xs">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-hairline [&>th]:bg-surface-2 [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th]:text-muted">
                    <th>Origem</th>
                    <th>Débito</th>
                    <th>Crédito</th>
                    <th className="text-right">Valor</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {casadas
                    .map((c, i) => ({ c, i }))
                    .filter(({ c }) => filtroStatus === null || c.status === filtroStatus)
                    .map(({ c, i }) => {
                    const b = BADGE[c.status];
                    const Icone = b.icone;
                    const editar = editando === i || c.status !== "casada";
                    const contaCell = editar ? (
                      <ContaDropdown
                        empresa={empresa}
                        valor={c.conta}
                        onMudar={(conta) => escolherConta(i, conta)}
                        limpavel
                        largura="w-80"
                      />
                    ) : (
                      <button
                        onClick={() => setEditando(i)}
                        className="flex items-center gap-1.5 text-left text-ink hover:text-accent"
                      >
                        <span>
                          <span className="font-mono">{c.conta}</span>{" "}
                          <span className="text-muted">{c.contaDescr}</span>
                        </span>
                        <Pencil className="size-3 shrink-0 opacity-50" />
                      </button>
                    );
                    // No arquivo: devedor → débito na conta, crédito na transitória;
                    // credor → o contrário. A conta editável fica no lado certo.
                    const trans = (
                      <span className="font-mono text-muted">{contaImpl ?? "—"}</span>
                    );
                    const dash = <span className="text-muted">—</span>;
                    const debito = c.natureza === "C" ? trans : contaCell;
                    const credito =
                      c.natureza === "C" ? contaCell : c.natureza === "D" ? trans : dash;
                    return (
                      <tr
                        key={c.origem.chave + i}
                        className="border-b border-hairline align-top [&>td]:px-3 [&>td]:py-2"
                      >
                        <td>
                          <div className="font-medium text-ink">{c.origem.descricao}</div>
                          <div className="text-[10px] text-muted">
                            {c.origem.chave}
                            {c.origem.classif ? ` · ${c.origem.classif}` : ""}
                          </div>
                        </td>
                        <td>{debito}</td>
                        <td>{credito}</td>
                        <td className="whitespace-nowrap text-right text-ink-2">
                          {brl(c.origem.saldo)}{" "}
                          <span className="text-[10px] text-muted">{c.natureza ?? "?"}</span>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                              b.cor
                            )}
                          >
                            <Icone className="size-3" />
                            {b.rotulo}
                            {c.status === "duvidosa" && (
                              <span className="opacity-70">{Math.round(c.confianca * 100)}%</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Fechamento e geração */}
          <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
            {resumo.semConta > 0 ? (
              <p className="text-xs text-critical">
                Resolva as {resumo.semConta} contas sem correspondência antes de gerar — senão o
                balancete não fecha.
              </p>
            ) : (
              <p className={clsx("text-xs", resumo.fecha ? "text-good" : "text-critical")}>
                {resumo.fecha
                  ? `Balancete fecha: débitos ${brl(resumo.deb)} = créditos ${brl(resumo.cred)}.`
                  : `Balancete NÃO fecha: débitos ${brl(resumo.deb)} × créditos ${brl(resumo.cred)} (diferença ${brl(Math.abs(resumo.deb - resumo.cred))}). A leitura do PDF pode ter vindo incompleta — confira as contas.`}
              </p>
            )}
            <button
              onClick={gerar}
              disabled={ocupado || !podeGerar}
              className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Download className="size-4" />
              Gerar arquivo do Questor
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  cor,
  ativo,
  onClick,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "card p-3 text-left transition-colors hover:border-accent/40",
        ativo && "border-accent/60 ring-1 ring-accent/40"
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</p>
      <p className={clsx("text-xl font-semibold", cor)}>{valor}</p>
    </button>
  );
}

function Campo({
  rotulo,
  className,
  children,
}: {
  rotulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={clsx("grid gap-1.5", className)}>
      <span className="text-xs font-medium text-ink-2">{rotulo}</span>
      {children}
    </label>
  );
}
