"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Layers,
  Receipt,
  Search,
  ShieldCheck,
  Tags,
  Truck,
  X,
} from "lucide-react";
import clsx from "clsx";
import { Button, Card, EmptyState } from "@/components/ui";
import { SeletorTipo } from "@/components/charts/top-bar-chart";
import { Kpi } from "@/components/kpi-conf";
import { FacetaDropdown } from "@/components/filters/faceta-dropdown";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { NotaDetalheModal } from "@/components/nota-detalhe-modal";
import { SituacaoBadge } from "@/components/situacao-badge";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import { useConferencia } from "@/hooks/use-api";
import { brl, brlCompact, dataBR, num } from "@/lib/format";
import type { NotaConferida, SituacaoNota } from "@/lib/types";

type Tipo = "ent" | "sai";
type FiltroSituacao = "problema" | "todas" | SituacaoNota;
type Ordem = "valor_desc" | "valor_asc" | "data_desc" | "data_asc" | "numero";

const SITUACOES: { id: FiltroSituacao; rotulo: string }[] = [
  { id: "problema", rotulo: "Com problema" },
  { id: "todas", rotulo: "Todas" },
  { id: "pendente", rotulo: "Não contabilizadas" },
  { id: "consolidada", rotulo: "Em bloco" },
  { id: "divergente", rotulo: "Conta errada" },
  { id: "duplicada", rotulo: "Duplicadas" },
  { id: "ok", rotulo: "Corretas" },
  { id: "nao_exige", rotulo: "Não exigem" },
  { id: "cancelada", rotulo: "Canceladas" },
];

const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: "valor_desc", rotulo: "Maior valor" },
  { id: "valor_asc", rotulo: "Menor valor" },
  { id: "data_desc", rotulo: "Mais recente" },
  { id: "data_asc", rotulo: "Mais antiga" },
  { id: "numero", rotulo: "Nº da nota" },
];

// Linha enxuta de uma linha só: o detalhe (itens, divergências, doc/UF) mora no
// modal, aberto ao clicar. A situação e a contagem de divergências ficam à vista
// para não precisar abrir só para saber o que tem problema.
function Linha({ nota, onAbrir }: { nota: NotaConferida; onAbrir: () => void }) {
  return (
    <tr
      onClick={onAbrir}
      className="group cursor-pointer border-b border-hairline/60 transition-colors last:border-0 hover:bg-surface-2/60"
    >
      <td className="py-2.5 pr-3 tabular-nums whitespace-nowrap">
        {num(nota.numero)}
        {nota.serie && <span className="text-muted">/{nota.serie}</span>}
        <span className="ml-2 text-[11px] text-muted">{dataBR(nota.data)}</span>
      </td>
      <td className="max-w-[260px] py-2.5 pr-3">
        <span className="block truncate text-ink" title={nota.contraparte ?? ""}>
          {nota.contraparte ?? "—"}
        </span>
      </td>
      <td
        className="max-w-[130px] py-2.5 pr-3 text-xs text-muted"
        title={nota.cfops.join(", ")}
      >
        <span className="block truncate">{nota.cfops.join(", ") || "—"}</span>
      </td>
      <td className="py-2.5 pr-3 whitespace-nowrap">
        <SituacaoBadge situacao={nota.situacao} />
        {nota.divergencias.length > 0 && (
          <span className="ml-1.5 tabular-nums text-[11px] text-critical">
            {nota.divergencias.length}{" "}
            {nota.divergencias.length === 1 ? "divergência" : "divergências"}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-ink">
        {brl(nota.valor)}
      </td>
      <td className="w-6 py-2.5 pl-1 text-muted">
        <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </td>
    </tr>
  );
}

export default function ConferenciaPage() {
  const { filtros, qs } = useFiltros();
  const [tipo, setTipo] = useEstadoSecao<Tipo>("tipo", "ent");
  const [situacao, setSituacao] = useEstadoSecao<FiltroSituacao>("situacao", "problema");
  const [busca, setBusca] = useEstadoSecao("busca", "");
  const [buscaAplicada, setBuscaAplicada] = useEstadoSecao("buscaAplicada", "");
  const [especies, setEspecies] = useEstadoSecao<string[]>("especies", []);
  const [cfops, setCfops] = useEstadoSecao<string[]>("cfops", []);
  const [ordem, setOrdem] = useEstadoSecao<Ordem>("ordem", "valor_desc");
  const [pagina, setPagina] = useEstadoSecao("pagina", 1);
  // Nota aberta no modal de detalhe — efêmero, não sobrevive à navegação.
  const [notaAberta, setNotaAberta] = useState<NotaConferida | null>(null);
  const temEmpresa = filtros.empresas.length === 1;

  // Digitar não dispara consulta a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 350);
    return () => clearTimeout(t);
  }, [busca, setBuscaAplicada]);

  // Qualquer mudança de recorte recomeça na primeira página — mas voltar da
  // Configuração não é mudança: zerar na remontagem perderia a página guardada.
  const recorte = [tipo, situacao, buscaAplicada, ordem, ...especies, "|", ...cfops].join(" ");
  const recorteAnterior = useRef(recorte);
  useEffect(() => {
    if (recorteAnterior.current === recorte) return;
    recorteAnterior.current = recorte;
    setPagina(1);
  }, [recorte, setPagina]);

  const url = useMemo(() => {
    const p = new URLSearchParams(qs);
    p.set("tipo", tipo);
    p.set("situacao", situacao);
    p.set("ordem", ordem);
    p.set("pagina", String(pagina));
    if (buscaAplicada) p.set("busca", buscaAplicada);
    if (especies.length) p.set("especies", especies.join(","));
    if (cfops.length) p.set("cfops", cfops.join(","));
    return p.toString();
  }, [qs, tipo, situacao, ordem, pagina, buscaAplicada, especies, cfops]);

  const conf = useConferencia(url, temEmpresa);
  const dados = conf.data;
  const r = dados?.resumo;

  const temFiltroExtra = !!buscaAplicada || especies.length > 0 || cfops.length > 0;

  if (!temEmpresa) {
    return <EmptyState icon={<Building2 className="size-6" />} titulo="Selecione uma empresa" />;
  }

  const exigem = (r?.contabilizadas ?? 0) + (r?.pendentes ?? 0);
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <>
      <div className="flex justify-end">
        <SeletorTipo tipo={tipo} onTipo={setTipo} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {conf.isLoading || !r ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <Kpi
              rotulo={tipo === "ent" ? "Notas de entrada" : "Notas de saída"}
              icone={<FileText className="size-4 text-ent" />}
              corIcone="bg-ent/12"
              valor={num(r.total)}
              secundario={`${num(r.naoExigem)} não exigem lançamento`}
            />
            <Kpi
              rotulo="Pendentes de lançamento"
              icone={<AlertTriangle className="size-4 text-warn" />}
              corIcone="bg-warn/12"
              valor={num(r.pendentes)}
              secundario={`${brlCompact(r.valorPendente)} a contabilizar`}
              alerta={r.pendentes > 0}
            />
            <Kpi
              rotulo="Contabilizadas em bloco"
              icone={<Layers className="size-4 text-ent" />}
              corIcone="bg-ent/12"
              valor={num(r.consolidadas)}
              secundario={
                r.consolidadas > 0
                  ? `${brlCompact(r.valorConsolidado)} em consolidação`
                  : "sem consolidação"
              }
            />
            <Kpi
              rotulo="Lançadas na conta errada"
              icone={<Truck className="size-4 text-critical" />}
              corIcone="bg-critical/12"
              valor={num(r.divergentes)}
              secundario={`de ${num(r.contabilizadas)} contabilizadas`}
              alerta={r.divergentes > 0}
            />
            <Kpi
              rotulo="Contabilizadas em duplicidade"
              icone={<Copy className="size-4 text-sai" />}
              corIcone="bg-sai/12"
              valor={num(r.duplicadas)}
              secundario={
                r.duplicadas > 0
                  ? `${brlCompact(r.valorDuplicado)} lançado a mais`
                  : "nenhuma repetida"
              }
              alerta={r.duplicadas > 0}
            />
            <Kpi
              rotulo="Corretas"
              icone={<ShieldCheck className="size-4 text-good" />}
              corIcone="bg-good/12"
              valor={num(r.conformes)}
              secundario={
                exigem > 0
                  ? `${((r.conformes / exigem) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do que exige lançamento`
                  : "—"
              }
            />
          </>
        )}
      </div>

      <Card as="section">
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Notas do período</h2>
              <p className="mt-0.5 text-xs text-muted">
                {dados
                  ? `${num(dados.total)} ${dados.total === 1 ? "nota" : "notas"} no filtro`
                  : "…"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                icone={<ArrowUpDown className="size-4" />}
                rotulo={ORDENS.find((o) => o.id === ordem)?.rotulo ?? "Ordenar"}
                largura="w-48"
              >
                {(fechar) => (
                  <div className="py-1">
                    {ORDENS.map((o) => (
                      <ItemLista
                        key={o.id}
                        selecionado={o.id === ordem}
                        onClick={() => {
                          setOrdem(o.id);
                          fechar();
                        }}
                      >
                        <span className="grid size-4 place-items-center">
                          {o.id === ordem && <Check className="size-4 stroke-[3] text-accent" />}
                        </span>
                        {o.rotulo}
                      </ItemLista>
                    ))}
                  </div>
                )}
              </Dropdown>
              <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5">
                <Search className="size-4 text-muted" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nº, contraparte, CNPJ ou UF…"
                  className="w-52 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
                />
              </div>
            </div>
          </div>

          {/* Situação: o filtro principal */}
          <div className="flex flex-wrap items-center gap-1">
            {SITUACOES.map((s) => {
              const qtd = !r
                ? null
                : s.id === "todas"
                  ? r.total
                  : s.id === "problema"
                    ? r.pendentes + r.divergentes + r.duplicadas
                    : s.id === "ok"
                      ? r.conformes
                      : s.id === "pendente"
                        ? r.pendentes
                        : s.id === "consolidada"
                          ? r.consolidadas
                          : s.id === "divergente"
                            ? r.divergentes
                            : s.id === "duplicada"
                              ? r.duplicadas
                              : s.id === "nao_exige"
                                ? r.naoExigem
                                : r.canceladas;
              return (
                <button
                  key={s.id}
                  onClick={() => setSituacao(s.id)}
                  className={clsx(
                    "rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                    situacao === s.id
                      ? "bg-accent/12 font-medium text-accent"
                      : "text-muted hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  {s.rotulo}
                  {qtd != null && <span className="ml-1 tabular-nums">{num(qtd)}</span>}
                </button>
              );
            })}
          </div>

          {/* Refinos: só os valores que existem no recorte atual */}
          <div className="flex flex-wrap items-center gap-2">
            <FacetaDropdown
              rotulo="Espécie"
              icone={<Receipt className="size-4" />}
              opcoes={dados?.facetas.especies ?? []}
              selecionados={especies}
              onMudar={setEspecies}
              largura="w-60"
            />
            <FacetaDropdown
              rotulo="CFOP"
              icone={<Tags className="size-4" />}
              opcoes={dados?.facetas.cfops ?? []}
              selecionados={cfops}
              onMudar={setCfops}
              buscavel
              largura="w-96"
            />
            {temFiltroExtra && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setBusca("");
                  setEspecies([]);
                  setCfops([]);
                }}
              >
                <X className="size-3.5" /> Limpar filtros
              </Button>
            )}
          </div>
        </header>

        {conf.isLoading || !dados ? (
          <div className="skeleton h-80 w-full" />
        ) : dados.notas.length === 0 ? (
          <div className="grid h-32 place-items-center gap-2 text-center">
            <CheckCircle2 className="mx-auto size-6 text-good" />
            <p className="text-sm text-muted">
              {situacao === "problema" && !temFiltroExtra
                ? "Nada pendente e nada fora do plano"
                : "Nenhuma nota com esse filtro"}
            </p>
          </div>
        ) : (
          <div className={clsx(conf.isFetching && !conf.isLoading && "refetching")}>
            <div className="max-h-[34rem] overflow-auto">
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-hairline text-xs text-muted">
                    <th className="py-2 pr-3 text-left font-medium">Nº / Data</th>
                    <th className="py-2 pr-3 text-left font-medium">
                      {tipo === "ent" ? "Fornecedor" : "Cliente"}
                    </th>
                    <th className="py-2 pr-3 text-left font-medium">CFOP</th>
                    <th className="py-2 pr-3 text-left font-medium">Situação</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {dados.notas.map((n) => (
                    <Linha key={n.chave} nota={n} onAbrir={() => setNotaAberta(n)} />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
                <p className="text-xs text-muted">
                  Página {dados.pagina} de {num(totalPaginas)}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={dados.pagina <= 1}
                  >
                    <ChevronLeft className="size-3.5" /> Anterior
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={dados.pagina >= totalPaginas}
                  >
                    Próxima <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <NotaDetalheModal
        nota={notaAberta}
        tipo={tipo}
        empresa={filtros.empresas[0]}
        onFechar={() => setNotaAberta(null)}
      />
    </>
  );
}
