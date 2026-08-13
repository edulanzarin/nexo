"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Download, Filter, Loader2, Search, Table2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { SeletorTipo } from "@/components/charts/top-bar-chart";
import { ContraparteModal, type PessoaSel } from "@/components/filters/contraparte-modal";
import { NotaExploradorModal } from "@/components/nota-explorador-modal";
import { useNotasLista } from "@/hooks/use-api";
import { exportarCSV } from "@/lib/exportar";
import { brl, dataBR, documento, num } from "@/lib/format";
import type { NotaLista, NotasListaResp } from "@/lib/types";

type Tipo = "ent" | "sai";
type Situacao = "todas" | "normais" | "canceladas";

const SITUACOES: { id: Situacao; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "normais", rotulo: "Normais" },
  { id: "canceladas", rotulo: "Canceladas" },
];

export function NotasTabela({ qs, enabled, mostraEmpresa, modulo = "fiscal" }: {
  qs: string;
  enabled: boolean;
  mostraEmpresa: boolean;
  /** Módulo que serve os dados — Fiscal (Dados) ou Contábil (Notas). Só troca
   *  a rota da listagem, dos itens e das contrapartes; a UI é a mesma. */
  modulo?: "fiscal" | "contabil";
}) {
  const [tipo, setTipo] = useState<Tipo>("sai");
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [pessoa, setPessoa] = useState<PessoaSel | null>(null);
  const [modalContra, setModalContra] = useState(false);
  const [page, setPage] = useState(1);
  // Nota aberta no modal de detalhe — efêmera, não sobrevive à troca de recorte.
  const [notaAberta, setNotaAberta] = useState<NotaLista | null>(null);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  // volta pra página 1 quando muda filtro/busca/tipo/situação/contraparte
  const recorte = `${qs}|${tipo}|${buscaDeb}|${situacao}|${pessoa?.codigo ?? ""}`;
  const recorteAnterior = useRef(recorte);
  useEffect(() => {
    if (recorteAnterior.current === recorte) return;
    recorteAnterior.current = recorte;
    setPage(1);
    setNotaAberta(null);
  }, [recorte]);

  const { data, isLoading, isFetching } = useNotasLista(
    qs,
    tipo,
    page,
    buscaDeb,
    situacao,
    pessoa?.codigo ?? null,
    enabled,
    modulo
  );
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const inicio = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, total);

  const colSpan = mostraEmpresa ? 8 : 7;

  const linhas = useMemo(() => data?.rows ?? [], [data]);

  const [exportando, setExportando] = useState(false);
  const exportar = async () => {
    if (exportando || total === 0) return;
    setExportando(true);
    try {
      const url =
        `/api/${modulo}/notas-lista?${qs}&tipo=${tipo}&busca=${encodeURIComponent(buscaDeb)}` +
        `&situacao=${situacao}${pessoa ? `&pessoa=${pessoa.codigo}` : ""}&export=1`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Falha ao gerar a exportação");
      const dados = (await resp.json()) as NotasListaResp;
      const cab = [
        "Data",
        ...(mostraEmpresa ? ["Empresa"] : []),
        "Número",
        "Série",
        "Espécie",
        "Contraparte",
        "Documento",
        "UF",
        "Valor",
        "Cancelada",
      ];
      const rows = dados.rows.map((n) => [
        dataBR(n.data),
        ...(mostraEmpresa ? [n.empresaNome ?? `Empresa ${n.empresa}`] : []),
        n.numero,
        n.serie ?? "",
        n.especie,
        n.contraparte ?? "",
        n.contraparteDoc ?? "",
        n.uf ?? "",
        n.valor,
        n.cancelada ? "sim" : "",
      ]);
      exportarCSV(modulo, `notas-${tipo === "sai" ? "saidas" : "entradas"}`, cab, rows);
      if (dados.total > dados.rows.length) {
        toast.warning(`Exportadas ${num(dados.rows.length)} de ${num(dados.total)} notas (teto de exportação).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExportando(false);
    }
  };

  return (
    <section className="card anim-fade-up overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink-2">
            <Table2 className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Notas fiscais</h2>
            <p className="mt-0.5 text-xs text-muted">
              {total > 0
                ? `${num(total)} ${total === 1 ? "nota" : "notas"} no período`
                : "Dados brutos"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5">
            <Search className="size-3.5 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              inputMode="numeric"
              placeholder="Nº da nota…"
              className="w-28 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
            />
          </div>
          <button
            onClick={() => setModalContra(true)}
            className={clsx(
              "flex h-[34px] items-center gap-2 rounded-lg border px-3 text-xs transition-colors",
              pessoa
                ? "border-accent/40 bg-accent/10 text-ink"
                : "border-hairline bg-surface-2 text-ink-2 hover:text-ink"
            )}
          >
            <Filter className="size-3.5" />
            <span className="max-w-40 truncate">{pessoa ? pessoa.nome : "Contraparte"}</span>
          </button>
          <div className="flex rounded-lg border border-hairline bg-surface-2 p-0.5 text-xs">
            {SITUACOES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSituacao(s.id)}
                className={clsx(
                  "rounded-md px-2.5 py-1 transition-colors",
                  situacao === s.id
                    ? "bg-surface font-medium text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                )}
              >
                {s.rotulo}
              </button>
            ))}
          </div>
          <SeletorTipo tipo={tipo} onTipo={setTipo} />
          <button
            onClick={exportar}
            disabled={exportando || total === 0}
            title="Exportar as notas filtradas em CSV"
            className="flex h-[34px] items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 text-xs text-ink-2 transition-colors hover:text-ink disabled:opacity-40"
          >
            {exportando ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {exportando ? "Gerando…" : "Exportar CSV"}
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-hairline">
              <th className="py-2.5 pl-5 pr-3 font-medium">Data</th>
              {mostraEmpresa && <th className="py-2.5 pr-3 font-medium">Empresa</th>}
              <th className="py-2.5 pr-3 font-medium">Nº · Série</th>
              <th className="py-2.5 pr-3 font-medium">Espécie</th>
              <th className="py-2.5 pr-3 font-medium">Contraparte</th>
              <th className="py-2.5 pr-3 font-medium">UF</th>
              <th className="py-2.5 pr-3 text-right font-medium">Valor</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody className={clsx(isFetching && !isLoading && "opacity-60 transition-opacity")}>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-hairline/60">
                  <td className="py-2.5 pl-5" colSpan={colSpan}>
                    <div className="skeleton h-4 w-full" />
                  </td>
                </tr>
              ))}

            {!isLoading && linhas.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-muted">
                  Nenhuma nota encontrada com esses filtros.
                </td>
              </tr>
            )}

            {!isLoading &&
              linhas.map((n: NotaLista) => (
                <Linha
                  key={`${n.empresa}-${n.chave}`}
                  n={n}
                  mostraEmpresa={mostraEmpresa}
                  onAbrir={() => setNotaAberta(n)}
                />
              ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-4 text-xs text-muted">
        <span>
          {total > 0 ? `${num(inicio)}–${num(fim)} de ${num(total)}` : "—"}
          {isFetching && !isLoading && <Loader2 className="ml-2 inline size-3 animate-spin" />}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-hairline px-2.5 py-1 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="px-2 tnum">
            {page} / {num(totalPaginas)}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            disabled={page >= totalPaginas}
            className="rounded-md border border-hairline px-2.5 py-1 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </footer>
      <ContraparteModal
        aberto={modalContra}
        onFechar={() => setModalContra(false)}
        qs={qs}
        tipo={tipo}
        selecionado={pessoa}
        onSelecionar={setPessoa}
        modulo={modulo}
      />
      <NotaExploradorModal
        nota={notaAberta}
        tipo={tipo}
        modulo={modulo}
        mostraEmpresa={mostraEmpresa}
        onFechar={() => setNotaAberta(null)}
      />
    </section>
  );
}

function Linha({ n, mostraEmpresa, onAbrir }: {
  n: NotaLista;
  mostraEmpresa: boolean;
  onAbrir: () => void;
}) {
  return (
    <tr
      onClick={onAbrir}
      className={clsx(
        "group cursor-pointer border-b border-hairline/60 transition-colors hover:bg-surface-2/60",
        n.cancelada && "text-muted"
      )}
    >
      <td className="tnum py-2.5 pl-5 pr-3 whitespace-nowrap">{dataBR(n.data)}</td>
      {mostraEmpresa && (
        <td className="max-w-[180px] truncate py-2.5 pr-3" title={n.empresaNome ?? ""}>
          {n.empresaNome ?? `Empresa ${n.empresa}`}
        </td>
      )}
      <td className="tnum py-2.5 pr-3 whitespace-nowrap">
        {n.numero}
        {n.serie ? <span className="text-muted">/{n.serie}</span> : null}
      </td>
      <td className="py-2.5 pr-3">
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2">{n.especie}</span>
        {n.cancelada && (
          <span className="ml-1.5 rounded bg-sai/12 px-1.5 py-0.5 text-xs text-sai">cancelada</span>
        )}
      </td>
      <td className="max-w-[280px] py-2.5 pr-3">
        <div className="truncate" title={n.contraparte ?? ""}>{n.contraparte ?? "—"}</div>
        {n.contraparteDoc && (
          <div className="tnum text-xs text-muted">{documento(n.contraparteDoc)}</div>
        )}
      </td>
      <td className="py-2.5 pr-3 text-muted">{n.uf ?? "—"}</td>
      <td
        className={clsx(
          "tnum py-2.5 pr-3 text-right font-medium whitespace-nowrap",
          n.cancelada && "line-through"
        )}
      >
        {brl(n.valor)}
      </td>
      <td className="w-6 py-2.5 pl-1 pr-5 text-muted">
        <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </td>
    </tr>
  );
}
