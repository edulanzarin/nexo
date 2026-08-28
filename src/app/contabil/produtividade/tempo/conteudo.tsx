"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarDays, Clock, Timer, Users } from "lucide-react";
import { StatTile } from "@/components/ui";
import { ProdPessoaFiltro } from "@/components/prod-pessoa-filtro";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbRankingTabela, type ColunaRanking } from "@/components/ctb-ranking-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbSerieSimples } from "@/components/charts/ctb-serie-simples";
import { CtbDispersao } from "@/components/charts/ctb-dispersao";
import { useFiltros } from "@/hooks/use-filters";
import { useContabilTempo } from "@/hooks/use-api";
import { dataBR, num, numCompact } from "@/lib/format";
import { decimalBR } from "@/lib/csv";
import type { CtbTempoPessoa } from "@/lib/contabil-tempo-tipos";
import { emHoras, slug } from "@/lib/prod-formato";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const umaCasa = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const COLUNAS: ColunaRanking<CtbTempoPessoa>[] = [
  { key: "horas", rotulo: "Horas", valor: (p) => p.horas, render: (p) => emHoras(p.horas) },
  { key: "dias", rotulo: "Dias", titulo: "Dias com algum tempo registrado", valor: (p) => p.dias },
  {
    key: "horasPorDia",
    rotulo: "Horas por dia",
    valor: (p) => p.horasPorDia,
    render: (p) => emHoras(p.horasPorDia),
  },
  { key: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { key: "lancamentos", rotulo: "Lançamentos", valor: (p) => p.lancamentos },
  {
    key: "porHora",
    rotulo: "Lançtos/hora",
    titulo:
      "Lançamentos por hora no Questor. Compara pessoas entre si; o número absoluto infla porque a importação fiscal grava em lote, sem consumir hora humana.",
    valor: (p) => p.porHora,
    render: (p) => umaCasa(p.porHora),
  },
];

export default function TempoContabilPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);

  const consulta = useContabilTempo(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: Math.round(p.horas) })),
    [d]
  );

  const empresas = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (pessoa) {
      return pessoa.topEmpresas.map((e) => ({ chave: e.chave, nome: e.nome, qtd: e.qtd }));
    }
    return d.empresas.slice(0, 12).map((e) => ({
      chave: e.chave,
      nome: e.nome,
      qtd: Math.round(e.horas * 10) / 10,
      detalhe:
        e.minutosPorLancamento == null
          ? `${num(e.pessoas)} pessoa(s) · sem lançamento no período`
          : `${num(e.pessoas)} pessoa(s) · ${umaCasa(e.minutosPorLancamento)} min por lançamento`,
    }));
  }, [d, pessoa]);

  const porDiaSemana = useMemo<BarraItem[] | undefined>(
    () =>
      d?.porDiaSemana.map((horas, i) => ({
        chave: String(i),
        nome: DIAS_SEMANA[i],
        qtd: Math.round(horas * 10) / 10,
      })),
    [d]
  );

  const serie = useMemo(
    () => d?.serie.map((p) => ({ bucket: p.bucket, valor: p.horas })),
    [d]
  );

  const dispersao = useMemo(
    () =>
      d?.ranking.map((p) => ({
        codigo: p.codigo,
        nome: p.nome,
        horas: p.horas,
        lancamentos: p.lancamentos,
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
        rotulo: "Tempo por pessoa",
        descricao: "Uma linha por pessoa — sempre o time inteiro",
        nome: `tempo-contabil-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Horas", "Dias", "Horas por dia", "Empresas",
            "Lançamentos", "Lançamentos por hora",
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            decimalBR(p.horas),
            p.dias,
            decimalBR(p.horasPorDia),
            p.empresas,
            p.lancamentos,
            decimalBR(p.porHora),
          ]),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Tempo por empresa",
        descricao: "Quanto tempo cada empresa consumiu do time contábil",
        nome: `tempo-contabil-empresas-${periodo}${alvo}`,
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Código", "Empresa", "Horas"],
                linhas: pessoa.topEmpresas.map((e) => [e.chave, e.nome, decimalBR(e.qtd)]),
              }
            : {
                cabecalhos: [
                  "Código", "Empresa", "Horas", "Pessoas", "Lançamentos", "Minutos por lançamento",
                ],
                linhas: d.empresas.map((e) => [
                  e.chave,
                  e.nome,
                  decimalBR(e.horas),
                  e.pessoas,
                  e.lancamentos,
                  e.minutosPorLancamento == null ? "" : decimalBR(e.minutosPorLancamento),
                ]),
              },
      },
      {
        id: "serie",
        rotulo: "Horas no período",
        descricao: d.periodo.granularidade === "mes" ? "Um mês por linha" : "Um dia por linha",
        nome: `tempo-contabil-evolucao-${periodo}`,
        montar: () => ({
          cabecalhos: [d.periodo.granularidade === "mes" ? "Mês" : "Dia", "Horas"],
          linhas: d.serie.map((p) => [dataBR(p.bucket), decimalBR(p.horas)]),
        }),
      },
    ];
  }, [d, pessoa]);

  const horas = pessoa ? pessoa.horas : (d?.totais.horas ?? 0);
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time contábil";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ProdPessoaFiltro dados={opcoesPessoa} valor={pessoaSel} onMudar={setPessoaSel} />
        <span className="text-xs text-muted">
          Tempo medido pelo Questor inteiro, não só pelo módulo contábil · a filial não recorta aqui
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
              rotulo="Horas no Questor"
              icon={<Clock className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={`${numCompact(horas)} h`}
              valorCheio={emHoras(horas)}
              secundario={`${num(pessoa ? pessoa.dias : d.totais.dias)} dias com registro`}
            />
            <StatTile
              rotulo="Horas por dia"
              icon={<CalendarDays className="size-4 text-ink-2" />}
              valor={emHoras(pessoa ? pessoa.horasPorDia : d.totais.horasPorPessoaDia)}
              secundario={pessoa ? "média dela nos dias em que trabalhou" : "média por pessoa, por dia trabalhado"}
            />
            <StatTile
              rotulo="Horas por empresa"
              icon={<Timer className="size-4 text-ink-2" />}
              valor={emHoras(
                pessoa
                  ? pessoa.empresas > 0
                    ? pessoa.horas / pessoa.empresas
                    : 0
                  : d.totais.horasPorEmpresa
              )}
              secundario={
                pessoa
                  ? "média dela entre as empresas que tocou"
                  : `mais cara: ${d.empresas[0]?.nome ?? "—"} (${emHoras(d.empresas[0]?.horas)})`
              }
            />
            <StatTile
              rotulo="Pessoas"
              icon={<Users className="size-4 text-ink-2" />}
              valor={num(pessoa ? 1 : d.totais.pessoas)}
              secundario={
                d.foraDoContabil.pessoas > 0
                  ? `+${num(d.foraDoContabil.pessoas)} de outras áreas (${numCompact(d.foraDoContabil.horas)} h) fora da conta`
                  : "todas com lançamento no contábil no período"
              }
            />
            <StatTile
              rotulo="Empresas tocadas"
              icon={<Building2 className="size-4 text-ink-2" />}
              valor={num(pessoa ? pessoa.empresas : d.totais.empresas)}
              secundario={
                <span className="line-clamp-2">
                  {(pessoa ? pessoa.topEmpresas[0]?.nome : d.empresas[0]?.nome) ?? "sem registro"}
                </span>
              }
            />
          </>
        )}
      </div>

      <CtbRankingTabela
        titulo="Tempo por pessoa"
        subtitulo="Só quem lançou algo no contábil no período · clique numa pessoa para isolar o restante da tela"
        dados={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="horas"
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
        vazio="Ninguém do contábil tem tempo registrado no período"
        rodape={
          d && d.foraDoContabil.pessoas > 0
            ? `Fora desta lista: ${num(d.foraDoContabil.pessoas)} pessoa(s) com ${emHoras(d.foraDoContabil.horas)} no Questor que não lançaram nada no contábil no período — folha, fiscal e afins.`
            : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="Empresas que mais consomem tempo"
          subtitulo={
            pessoa ? `Onde ${pessoa.nome} passou o tempo` : "Horas do time contábil por empresa"
          }
          dados={empresas}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Empresa"
          rotuloQtd="Horas"
          formatarQtd={emHoras}
        />
        <CtbProdBarras
          titulo="Por dia da semana"
          subtitulo="Quando o time está dentro do sistema"
          dados={porDiaSemana}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Dia da semana"
          rotuloQtd="Horas"
          formatarQtd={emHoras}
          corPadrao="var(--esp-5)"
          limite={7}
        />
      </div>

      <CtbSerieSimples
        titulo="Horas no período"
        subtitulo={`Tempo dentro do Questor por ${d?.periodo.granularidade === "mes" ? "mês" : "dia"} — ${escopo}`}
        dados={serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        rotulo="Horas"
        formatar={(v) => `${numCompact(v)}h`}
        carregando={carregando}
        recarregando={recarregando}
      />

      <CtbDispersao dados={dispersao} carregando={carregando} recarregando={recarregando} />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {emHoras(d.totais.horas)} no tempouso ·{" "}
          {num(d.totais.lancamentos)} lançamentos no mesmo período · o tempo é do Questor inteiro,
          das pessoas que lançaram no contábil
        </p>
      )}
    </div>
  );
}
