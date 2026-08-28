"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarRange, Gauge, History, Layers } from "lucide-react";
import { StatTile } from "@/components/ui";
import { ProdPessoaFiltro } from "@/components/prod-pessoa-filtro";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbRankingTabela, type ColunaRanking } from "@/components/ctb-ranking-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbEscada } from "@/components/charts/ctb-escada";
import { CtbAtrasoSerie } from "@/components/charts/ctb-atraso-serie";
import { CtbCompetencias } from "@/components/charts/ctb-competencias";
import { useFiltros } from "@/hooks/use-filters";
import { useFiscalAtraso } from "@/hooks/use-api";
import { dataBR, mesBR, num, numCompact } from "@/lib/format";
import { FAIXAS_ATRASO_FISCAL, type FisAtrasoPessoa } from "@/lib/fiscal-atraso-tipos";
import { faixaDe } from "@/lib/prod-escala";
import { emDias, pctBR, pctDe, slug } from "@/lib/prod-formato";

const compet = (v: string | null) => (v ? mesBR(v + "-01") : "—");

const COLUNAS: ColunaRanking<FisAtrasoPessoa>[] = [
  {
    key: "mediana",
    rotulo: "Atraso mediano",
    titulo: "Metade das notas dela demorou mais que isto",
    valor: (p) => p.mediana ?? 0,
    render: (p) => emDias(p.mediana),
    // O alerta acompanha a escada da própria aba: no Fiscal o ciclo normal vai
    // até 30 dias, então só passar de 90 é dívida de verdade.
    alerta: (p) => (p.mediana ?? 0) > 90,
  },
  {
    key: "p90",
    rotulo: "p90",
    titulo: "9 em cada 10 notas saíram até este prazo",
    valor: (p) => p.p90 ?? 0,
    render: (p) => emDias(p.p90),
  },
  { key: "notas", rotulo: "Notas", valor: (p) => p.notas },
  {
    key: "noCiclo",
    rotulo: "No ciclo",
    titulo: "Notas escrituradas até 30 dias depois da data do documento",
    valor: (p) => pctDe(p.porFaixa[0], p.notas),
    render: (p) => `${pctBR(pctDe(p.porFaixa[0], p.notas))}%`,
  },
  {
    key: "competencias",
    rotulo: "Competências",
    titulo: "Quantos meses de documento ela tocou no período",
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

export default function AtrasoFiscalPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);

  const consulta = useFiscalAtraso(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.notas })),
    [d]
  );

  // Empresas: a barra mede o ATRASO, não o volume — é o ranking do que está mais
  // para trás. O volume vai no tooltip, para a mediana de um punhado de notas
  // não passar por problema grande.
  const empresas = useMemo<BarraItem[] | undefined>(
    () =>
      d?.empresas.slice(0, 12).map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: e.mediana ?? 0,
        cor: FAIXAS_ATRASO_FISCAL[faixaDe(FAIXAS_ATRASO_FISCAL, e.mediana ?? 0)].cor,
        detalhe: `${num(e.notas)} notas · desde ${compet(e.maisVelha)}`,
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
        nome: `atraso-fiscal-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Notas", "Atraso mediano (dias)", "p90 (dias)",
            "Competências", "Mais velha", "Empresas",
            ...FAIXAS_ATRASO_FISCAL.map((f) => f.rotulo),
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.notas,
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
        descricao: `As empresas com pelo menos ${d.minimoEmpresa} notas no período`,
        nome: `atraso-fiscal-empresas-${periodo}${alvo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Empresa", "Notas", "Atraso mediano (dias)", "p90 (dias)",
            "Competência mais velha",
            ...FAIXAS_ATRASO_FISCAL.map((f) => f.rotulo),
          ],
          linhas: d.empresas.map((e) => [
            e.chave,
            e.nome,
            e.notas,
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
        descricao: "Em que mês do documento o trabalho do período caiu",
        nome: `atraso-fiscal-competencias-${periodo}`,
        montar: () => ({
          cabecalhos: ["Competência", "Notas", "Atraso mediano (dias)", "Pessoas"],
          linhas: d.competencias.map((c) => [c.compet, c.qtd, c.mediana ?? "", c.pessoas]),
        }),
      },
      {
        id: "serie",
        rotulo: "Atraso ao longo do período",
        descricao: d.periodo.granularidade === "mes" ? "Um mês por linha" : "Um dia por linha",
        nome: `atraso-fiscal-evolucao-${periodo}`,
        montar: () => ({
          cabecalhos: [
            d.periodo.granularidade === "mes" ? "Mês" : "Dia",
            "Notas",
            "Atraso mediano (dias)",
            "p90 (dias)",
          ],
          linhas: d.serie.map((p) => [dataBR(p.bucket), p.total, p.mediana ?? "", p.p90 ?? ""]),
        }),
      },
    ];
  }, [d, pessoa]);

  const notas = pessoa ? pessoa.notas : (d?.totais.notas ?? 0);
  const mediana = pessoa ? pessoa.mediana : (d?.totais.mediana ?? null);
  const p90 = pessoa ? pessoa.p90 : (d?.totais.p90 ?? null);
  const porFaixa = pessoa ? pessoa.porFaixa : d?.totais.porFaixa;
  const noCiclo = pessoa ? pessoa.porFaixa[0] : (d?.totais.noCiclo ?? 0);
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ProdPessoaFiltro dados={opcoesPessoa} valor={pessoaSel} onMudar={setPessoaSel} />
        <span className="text-xs text-muted">
          {pessoa
            ? "Mostrando só os números desta pessoa · o ranking segue com o time todo"
            : "Atraso é a distância entre a data do documento e o carimbo da escrituração"}
        </span>
        <div className="ml-auto">
          <ExportarMenu modulo="fiscal" cortes={cortes} desabilitado={!d || carregando} />
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
              secundario="metade das notas demorou mais que isto"
              alerta={(mediana ?? 0) > 90}
            />
            <StatTile
              rotulo="9 em cada 10 até"
              icon={<Gauge className="size-4 text-ink-2" />}
              valor={emDias(p90)}
              secundario="o prazo que cobre quase tudo (p90)"
            />
            <StatTile
              rotulo="Dentro do ciclo"
              icon={<History className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={`${pctBR(pctDe(noCiclo, notas))}%`}
              secundario={`${numCompact(noCiclo)} de ${numCompact(notas)} notas até 30 dias`}
            />
            <StatTile
              rotulo="Competências abertas"
              icon={<Layers className="size-4 text-ink-2" />}
              valor={num(pessoa ? pessoa.competencias : d.totais.competencias)}
              secundario="meses de documento tocados no período"
            />
            <StatTile
              rotulo="Mais antiga"
              icon={<CalendarRange className="size-4 text-ink-2" />}
              valor={compet(pessoa ? pessoa.maisVelha : d.totais.maisVelha)}
              secundario="a competência mais velha que recebeu nota"
            />
          </>
        )}
      </div>

      <CtbEscada
        titulo="Distribuição do atraso"
        subtitulo={`Quanto cada nota ${escopo} esperou entre o documento e a escrituração · fechar o mês anterior no mês seguinte é o ciclo normal do fiscal`}
        faixas={FAIXAS_ATRASO_FISCAL}
        valores={porFaixa}
        rotuloItem="notas"
        carregando={carregando || !d}
      />

      <CtbCompetencias
        dados={d?.competencias}
        faixas={FAIXAS_ATRASO_FISCAL}
        rotuloItem="Notas"
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
        vazio="Ninguém escriturou nota no período"
        minWidth="min-w-[820px]"
        rodape="Ordenado pelo atraso mediano — quem escritura pouco e antigo sobe, então leia junto com a coluna Notas."
      />

      <CtbProdBarras
        titulo="Empresas mais atrasadas"
        subtitulo={`Atraso mediano em dias · só empresas com ${d?.minimoEmpresa ?? 20}+ notas no período`}
        dados={empresas}
        carregando={carregando}
        recarregando={recarregando}
        rotuloEixo="Empresa"
        rotuloQtd="Atraso mediano"
        formatarQtd={(v) => emDias(v)}
      />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.notas)} notas medidas
          entre datalctofis e datahoralctofis · mediana, nunca média
        </p>
      )}
    </div>
  );
}
