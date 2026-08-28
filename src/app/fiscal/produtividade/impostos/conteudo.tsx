"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Coins, Scale, Users } from "lucide-react";
import { StatTile } from "@/components/ui";
import { ProdPessoaFiltro } from "@/components/prod-pessoa-filtro";
import { ProdFaixaClasses } from "@/components/prod-faixa-classes";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbRankingTabela, type ColunaRanking } from "@/components/ctb-ranking-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbProdSerie } from "@/components/charts/ctb-prod-serie";
import { useFiltros } from "@/hooks/use-filters";
import { useFiscalImpostos } from "@/hooks/use-api";
import { brl, brlCompact, dataBR, num } from "@/lib/format";
import { decimalBR } from "@/lib/csv";
import { TRIBUTOS, type FisImpPessoa } from "@/lib/fiscal-impostos-tipos";
import type { ClasseInfo } from "@/lib/prod-tipos";
import { pctBR, pctDe, slug } from "@/lib/prod-formato";

const COLUNAS: ColunaRanking<FisImpPessoa>[] = [
  {
    key: "total",
    rotulo: "Tributo total",
    titulo: "Soma de todos os tributos das notas que ela escriturou",
    valor: (p) => p.total,
    render: (p) => brlCompact(p.total),
  },
  ...TRIBUTOS.map<ColunaRanking<FisImpPessoa>>((t) => ({
    key: t.id,
    rotulo: t.rotulo,
    titulo: t.descricao,
    valor: (p) => p.porTributo[t.id] ?? 0,
    render: (p) => brlCompact(p.porTributo[t.id] ?? 0),
  })),
  { key: "notas", rotulo: "Notas", valor: (p) => p.notas },
  {
    key: "porNota",
    rotulo: "Por nota",
    titulo: "Tributo médio por nota — a densidade fiscal do que cai na mão dela",
    valor: (p) => p.porNota,
    render: (p) => brlCompact(p.porNota),
  },
  { key: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
];

export default function ImpostosFiscalPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);

  const consulta = useFiscalImpostos(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: Math.round(p.total) })),
    [d]
  );

  // Só os tributos que existem no período viram legenda e faixa — degrau zerado
  // aqui não é afirmação, é tributo que a carteira simplesmente não tem.
  const classes = useMemo<ClasseInfo[]>(
    () =>
      (d?.tributos ?? []).map((t) => {
        const meta = TRIBUTOS.find((x) => x.id === t.id);
        return {
          id: t.id,
          rotulo: t.rotulo,
          descricao: meta?.descricao ?? "",
          cor: t.cor,
        };
      }),
    [d]
  );

  const porTributo = useMemo(() => {
    if (!d) return {};
    if (pessoa) return pessoa.porTributo;
    return Object.fromEntries(d.tributos.map((t) => [t.id, t.total]));
  }, [d, pessoa]);

  const barrasTributo = useMemo<BarraItem[] | undefined>(
    () =>
      d?.tributos.map((t) => ({
        chave: t.id,
        nome: t.rotulo,
        qtd: pessoa ? (pessoa.porTributo[t.id] ?? 0) : t.total,
        cor: t.cor,
        detalhe: pessoa
          ? undefined
          : `${brlCompact(t.entradas)} nas entradas · ${brlCompact(t.saidas)} nas saídas`,
      })),
    [d, pessoa]
  );

  const empresas = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (pessoa) {
      return pessoa.topEmpresas.map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: Math.round(e.valor),
      }));
    }
    return d.empresas.slice(0, 12).map((e) => ({
      chave: e.chave,
      nome: e.nome,
      qtd: Math.round(e.valor),
      detalhe: `${num(e.qtd)} notas · ${num(e.pessoas)} pessoa(s)`,
    }));
  }, [d, pessoa]);

  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const escala = d.periodo.granularidade === "mes" ? "Mês" : "Dia";
    return [
      {
        id: "pessoas",
        rotulo: "Tributo por pessoa",
        descricao: "Uma linha por pessoa, com cada tributo numa coluna — sempre o time inteiro",
        nome: `impostos-fiscal-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Notas", "Tributo total",
            ...d.tributos.map((t) => t.rotulo),
            "Tributo por nota", "Empresas",
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.notas,
            decimalBR(p.total),
            ...d.tributos.map((t) => decimalBR(p.porTributo[t.id] ?? 0)),
            decimalBR(p.porNota),
            p.empresas,
          ]),
        }),
      },
      {
        id: "empresas",
        rotulo: "Tributo por empresa",
        descricao: "As 200 empresas com mais tributo escriturado no período",
        nome: `impostos-fiscal-empresas-${periodo}${alvo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Empresa", "Notas", "Pessoas", "Tributo total",
            ...d.tributos.map((t) => t.rotulo),
          ],
          linhas: d.empresas.map((e) => [
            e.chave,
            e.nome,
            e.qtd,
            e.pessoas,
            decimalBR(e.valor),
            ...d.tributos.map((t) => decimalBR(e.porTributo[t.id] ?? 0)),
          ]),
        }),
      },
      {
        id: "tributos",
        rotulo: "Entradas × saídas por tributo",
        descricao: "Os dois lados separados — não é apuração, e por isso não são subtraídos",
        nome: `impostos-fiscal-tributos-${periodo}`,
        montar: () => ({
          cabecalhos: ["Tributo", "Entradas", "Saídas", "Total"],
          linhas: d.tributos.map((t) => [
            t.rotulo,
            decimalBR(t.entradas),
            decimalBR(t.saidas),
            decimalBR(t.total),
          ]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        descricao: `Um ${escala.toLowerCase()} por linha, com a quebra por tributo`,
        nome: `impostos-fiscal-evolucao-${periodo}`,
        montar: () => ({
          cabecalhos: [escala, "Total", ...d.tributos.map((t) => t.rotulo)],
          linhas: d.serie.map((p) => [
            dataBR(p.bucket),
            decimalBR(p.total),
            ...d.tributos.map((t) => decimalBR(typeof p[t.id] === "number" ? (p[t.id] as number) : 0)),
          ]),
        }),
      },
    ];
  }, [d, pessoa]);

  const total = pessoa ? pessoa.total : (d?.totais.total ?? 0);
  const notas = pessoa ? pessoa.notas : (d?.totais.notas ?? 0);
  const entradas = pessoa ? pessoa.entradas : (d?.totais.entradas ?? 0);
  const saidas = pessoa ? pessoa.saidas : (d?.totais.saidas ?? 0);
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ProdPessoaFiltro dados={opcoesPessoa} valor={pessoaSel} onMudar={setPessoaSel} />
        <span className="text-xs text-muted">
          {pessoa
            ? "Mostrando só o tributo das notas desta pessoa · o ranking segue com o time todo"
            : "Não é apuração: entrada e saída aparecem lado a lado, nunca subtraídas"}
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
              rotulo="Tributo escriturado"
              icon={<Coins className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={brlCompact(total)}
              valorCheio={brl(total)}
              secundario={`em ${num(notas)} notas`}
            />
            <StatTile
              rotulo="Nas entradas"
              icon={<ArrowDownLeft className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={brlCompact(entradas)}
              valorCheio={brl(entradas)}
              secundario={`${pctBR(pctDe(entradas, total))}% do tributo do período`}
            />
            <StatTile
              rotulo="Nas saídas"
              icon={<ArrowUpRight className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={brlCompact(saidas)}
              valorCheio={brl(saidas)}
              secundario={`${pctBR(pctDe(saidas, total))}% do tributo do período`}
            />
            <StatTile
              rotulo="Tributo por nota"
              icon={<Scale className="size-4 text-ink-2" />}
              valor={brlCompact(pessoa ? pessoa.porNota : notas > 0 ? total / notas : 0)}
              secundario="o peso médio de cada documento escriturado"
            />
            <StatTile
              rotulo="Pessoas"
              icon={<Users className="size-4 text-ink-2" />}
              valor={num(pessoa ? 1 : d.totais.pessoas)}
              secundario={`${num(pessoa ? pessoa.empresas : d.totais.empresas)} empresas no período`}
            />
          </>
        )}
      </div>

      {carregando || !d ? (
        <div className="skeleton h-24 w-full" />
      ) : (
        <ProdFaixaClasses classes={classes} porClasse={porTributo} total={total} />
      )}

      <CtbRankingTabela
        titulo="Tributo por pessoa"
        subtitulo="Clique numa pessoa para isolar os números do topo · ordene por qualquer tributo"
        dados={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="total"
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
        vazio="Nenhuma nota com tributo no período"
        minWidth="min-w-[1040px]"
        rodape="Volume alto e tributo baixo é varejo; o contrário é indústria ou serviço. A coluna que compara pessoas é a de tributo por nota."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="Por tributo"
          subtitulo={`De que é feito o tributo ${escopo}`}
          dados={barrasTributo}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Tributo"
          rotuloQtd="Valor"
          formatarQtd={(v) => brlCompact(v)}
        />
        <CtbProdBarras
          titulo="Por empresa"
          subtitulo={pessoa ? `Empresas de ${pessoa.nome}` : "Onde está o peso fiscal da carteira"}
          dados={empresas}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Empresa"
          rotuloQtd="Tributo"
          formatarQtd={(v) => brlCompact(v)}
        />
      </div>

      <CtbProdSerie
        dados={d?.serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        classes={classes}
        titulo="Tributo no período"
        rotuloItem="Tributo"
        subtitulo={`Valor escriturado por ${d?.periodo.granularidade === "mes" ? "mês" : "dia"}, por tributo`}
        carregando={carregando}
        recarregando={recarregando}
      />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {brl(d.totais.total)} de tributo em{" "}
          {num(d.totais.notas)} notas ({brl(d.totais.valor)} de valor contábil) · cada tributo lido
          da sua própria tabela de detalhe
        </p>
      )}
    </div>
  );
}
