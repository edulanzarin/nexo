"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarRange, Gauge, History, Layers } from "lucide-react";
import { StatTile } from "@/components/ui";
import { CtbPessoaFiltro } from "@/components/ctb-pessoa-filtro";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbRankingTabela, type ColunaRanking } from "@/components/ctb-ranking-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbEscada } from "@/components/charts/ctb-escada";
import { CtbAtrasoSerie } from "@/components/charts/ctb-atraso-serie";
import { CtbCompetencias } from "@/components/charts/ctb-competencias";
import { useFiltros } from "@/hooks/use-filters";
import { useContabilAtraso } from "@/hooks/use-api";
import { dataBR, mesBR, num, numCompact } from "@/lib/format";
import { FAIXAS_ATRASO, type CtbAtrasoPessoa } from "@/lib/contabil-atraso-tipos";
import { faixaDe } from "@/lib/contabil-prod-escala";
import { emDias, pctBR, pctDe, slug } from "@/lib/contabil-prod-formato";

const compet = (v: string | null) => (v ? mesBR(v + "-01") : "—");

const COLUNAS: ColunaRanking<CtbAtrasoPessoa>[] = [
  {
    key: "mediana",
    rotulo: "Atraso mediano",
    titulo: "Metade dos lançamentos dela demorou mais que isto",
    valor: (p) => p.mediana ?? 0,
    render: (p) => emDias(p.mediana),
    alerta: (p) => (p.mediana ?? 0) > 90,
  },
  {
    key: "p90",
    rotulo: "p90",
    titulo: "9 em cada 10 lançamentos saíram até este prazo",
    valor: (p) => p.p90 ?? 0,
    render: (p) => emDias(p.p90),
  },
  { key: "lancamentos", rotulo: "Lançamentos", valor: (p) => p.lancamentos },
  {
    key: "emDia",
    rotulo: "Em dia",
    titulo: "Lançamentos registrados até 5 dias depois do fato",
    valor: (p) => pctDe(p.porFaixa[0], p.lancamentos),
    render: (p) => `${pctBR(pctDe(p.porFaixa[0], p.lancamentos))}%`,
  },
  {
    key: "competencias",
    rotulo: "Competências",
    titulo: "Quantos meses de fato ela tocou no período",
    valor: (p) => p.competencias,
  },
  {
    key: "maisVelha",
    rotulo: "Mais velha",
    titulo: "A competência mais antiga em que mexeu",
    valor: (p) => (p.maisVelha ? -Number(p.maisVelha.replace("-", "")) : 0),
    render: (p) => compet(p.maisVelha),
  },
  { key: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
];

export default function AtrasoContabilPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);

  const consulta = useContabilAtraso(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.lancamentos })),
    [d]
  );

  // Empresas: a barra mede o ATRASO, não o volume — é o ranking do que está mais
  // para trás. O volume vai no tooltip, para a mediana de um punhado de
  // lançamentos não passar por problema grande.
  const empresas = useMemo<BarraItem[] | undefined>(
    () =>
      d?.empresas.slice(0, 12).map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: e.mediana ?? 0,
        cor: FAIXAS_ATRASO[faixaDe(FAIXAS_ATRASO, e.mediana ?? 0)].cor,
        detalhe: `${num(e.lancamentos)} lançamentos · desde ${compet(e.maisVelha)}`,
      })),
    [d]
  );

  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    return [
      {
        id: "pessoas",
        rotulo: "Atraso por pessoa",
        descricao: "Uma linha por pessoa — sempre o time inteiro",
        nome: `atraso-contabil-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Lançamentos", "Atraso mediano (dias)", "p90 (dias)",
            "Competências", "Mais velha", "Empresas",
            ...FAIXAS_ATRASO.map((f) => f.rotulo),
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.lancamentos,
            p.mediana ?? "",
            p.p90 ?? "",
            p.competencias,
            p.maisVelha ?? "",
            p.empresas,
            ...p.porFaixa,
          ]),
        }),
      },
      {
        id: "empresas",
        rotulo: "Atraso por empresa",
        descricao: `As empresas com pelo menos ${d.minimoEmpresa} lançamentos no período`,
        nome: `atraso-contabil-empresas-${periodo}${alvo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Empresa", "Lançamentos", "Atraso mediano (dias)", "p90 (dias)",
            "Competência mais velha",
            ...FAIXAS_ATRASO.map((f) => f.rotulo),
          ],
          linhas: d.empresas.map((e) => [
            e.chave,
            e.nome,
            e.lancamentos,
            e.mediana ?? "",
            e.p90 ?? "",
            e.maisVelha ?? "",
            ...e.porFaixa,
          ]),
        }),
      },
      {
        id: "competencias",
        rotulo: "Competências trabalhadas",
        descricao: "Em que mês do fato o trabalho do período caiu",
        nome: `atraso-contabil-competencias-${periodo}`,
        montar: () => ({
          cabecalhos: ["Competência", "Lançamentos", "Atraso mediano (dias)", "Pessoas"],
          linhas: d.competencias.map((c) => [c.compet, c.qtd, c.mediana ?? "", c.pessoas]),
        }),
      },
      {
        id: "serie",
        rotulo: "Atraso ao longo do período",
        descricao: d.periodo.granularidade === "mes" ? "Um mês por linha" : "Um dia por linha",
        nome: `atraso-contabil-evolucao-${periodo}`,
        montar: () => ({
          cabecalhos: [
            d.periodo.granularidade === "mes" ? "Mês" : "Dia",
            "Lançamentos",
            "Atraso mediano (dias)",
            "p90 (dias)",
          ],
          linhas: d.serie.map((p) => [dataBR(p.bucket), p.total, p.mediana ?? "", p.p90 ?? ""]),
        }),
      },
    ];
  }, [d, pessoa]);

  const lancamentos = pessoa ? pessoa.lancamentos : (d?.totais.lancamentos ?? 0);
  const mediana = pessoa ? pessoa.mediana : (d?.totais.mediana ?? null);
  const p90 = pessoa ? pessoa.p90 : (d?.totais.p90 ?? null);
  const porFaixa = pessoa ? pessoa.porFaixa : d?.totais.porFaixa;
  const emDia = pessoa ? pessoa.porFaixa[0] : (d?.totais.emDia ?? 0);
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <CtbPessoaFiltro dados={opcoesPessoa} valor={pessoaSel} onMudar={setPessoaSel} />
        <span className="text-xs text-muted">
          {pessoa
            ? "Mostrando só os números desta pessoa · o ranking segue com o time todo"
            : "Atraso é a distância entre a data do fato e o carimbo do registro"}
        </span>
        <div className="ml-auto">
          <ExportarMenu modulo="contabil" cortes={cortes} desabilitado={!d || carregando} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {carregando || !d ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <StatTile
              rotulo="Atraso mediano"
              icon={<CalendarClock className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={emDias(mediana)}
              secundario="metade dos lançamentos demorou mais que isto"
              alerta={(mediana ?? 0) > 90}
            />
            <StatTile
              rotulo="9 em cada 10 até"
              icon={<Gauge className="size-4 text-ink-2" />}
              valor={emDias(p90)}
              secundario="o prazo que cobre quase tudo (p90)"
            />
            <StatTile
              rotulo="Registrado em dia"
              icon={<History className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={`${pctBR(pctDe(emDia, lancamentos))}%`}
              secundario={`${numCompact(emDia)} de ${numCompact(lancamentos)} lançamentos até 5 dias`}
            />
            <StatTile
              rotulo="Competências abertas"
              icon={<Layers className="size-4 text-ink-2" />}
              valor={num(pessoa ? pessoa.competencias : d.totais.competencias)}
              secundario="meses de fato tocados no período"
            />
            <StatTile
              rotulo="Mais antiga"
              icon={<CalendarRange className="size-4 text-ink-2" />}
              valor={compet(pessoa ? pessoa.maisVelha : d.totais.maisVelha)}
              secundario="a competência mais velha que recebeu lançamento"
            />
          </>
        )}
      </div>

      <CtbEscada
        titulo="Distribuição do atraso"
        subtitulo={`Quanto tempo cada lançamento ${escopo} esperou entre o fato e o registro`}
        faixas={FAIXAS_ATRASO}
        valores={porFaixa}
        rotuloItem="lançamentos"
        carregando={carregando || !d}
      />

      <CtbCompetencias
        dados={d?.competencias}
        carregando={carregando}
        recarregando={recarregando}
      />

      <CtbAtrasoSerie
        dados={d?.serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        carregando={carregando}
        recarregando={recarregando}
      />

      <CtbRankingTabela
        titulo="Atraso por pessoa"
        subtitulo="Clique numa pessoa para isolar os números do topo · ordene por qualquer coluna"
        dados={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="mediana"
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
        vazio="Ninguém lançou nada no período"
        minWidth="min-w-[820px]"
        rodape="Ordenado pelo atraso mediano — quem lança pouco e antigo sobe, então leia junto com a coluna Lançamentos."
      />

      <CtbProdBarras
        titulo="Empresas mais atrasadas"
        subtitulo={`Atraso mediano em dias · só empresas com ${d?.minimoEmpresa ?? 20}+ lançamentos no período`}
        dados={empresas}
        carregando={carregando}
        recarregando={recarregando}
        rotuloEixo="Empresa"
        rotuloQtd="Atraso mediano"
        formatarQtd={(v) => emDias(v)}
      />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.lancamentos)} lançamentos
          medidos entre datalctoctb e datahoralctoctb · mediana, nunca média
        </p>
      )}
    </div>
  );
}
