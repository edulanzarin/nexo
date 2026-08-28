"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarClock, Eraser, RotateCcw, UserMinus } from "lucide-react";
import { StatTile, Delta } from "@/components/ui";
import { ProdPessoaFiltro } from "@/components/prod-pessoa-filtro";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbRankingTabela, type ColunaRanking } from "@/components/ctb-ranking-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbEscada } from "@/components/charts/ctb-escada";
import { CtbSerieSimples } from "@/components/charts/ctb-serie-simples";
import { CalendarioAtividade } from "@/components/charts/calendario-atividade";
import { useFiltros } from "@/hooks/use-filters";
import { useContabilExclusoes } from "@/hooks/use-api";
import { brl, brlCompact, dataBR, deltaPct, num, numCompact } from "@/lib/format";
import { decimalBR } from "@/lib/csv";
import { FAIXAS_IDADE } from "@/lib/contabil-exclusoes-tipos";
import type { CtbExclPessoa } from "@/lib/contabil-exclusoes-tipos";
import { CLASSES } from "@/lib/contabil-produtividade-tipos";
import { emDias, pctBR, pctDe, pico, slug } from "@/lib/prod-formato";

const COLUNAS: ColunaRanking<CtbExclPessoa>[] = [
  { key: "excluidos", rotulo: "Exclusões", valor: (p) => p.excluidos },
  {
    key: "deOutros",
    rotulo: "De outros",
    titulo: "Lançamentos que outra pessoa tinha feito",
    valor: (p) => p.excluidos - p.proprios,
  },
  {
    key: "idadeMediana",
    rotulo: "Idade mediana",
    titulo: "Metade do que apagou era mais velho que isto",
    valor: (p) => p.idadeMediana ?? 0,
    render: (p) => emDias(p.idadeMediana),
    alerta: (p) => (p.idadeMediana ?? 0) > 90,
  },
  {
    key: "idadeMaxima",
    rotulo: "Mais velho",
    titulo: "O lançamento mais antigo que ela apagou",
    valor: (p) => p.idadeMaxima,
    render: (p) => emDias(p.idadeMaxima),
  },
  { key: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { key: "dias", rotulo: "Dias", titulo: "Dias em que apagou alguma coisa", valor: (p) => p.dias },
  {
    key: "valor",
    rotulo: "Valor",
    valor: (p) => p.valor,
    render: (p) => brlCompact(p.valor),
  },
];

export default function ExclusoesContabilPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);

  const consulta = useContabilExclusoes(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.excluidos })),
    [d]
  );

  const corDaClasse = useMemo(() => new Map(CLASSES.map((c) => [c.id, c.cor])), []);
  const nomePorAutor = useMemo(
    () => new Map(d?.autores.map((a) => [a.chave, a.nome]) ?? []),
    [d]
  );

  const origens = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    const meta = new Map(d.origens.map((o) => [o.chave, o]));
    const base = pessoa ? pessoa.origens : d.origens;
    return base.map((o) => {
      const m = meta.get(o.chave);
      return {
        chave: o.chave,
        nome: m?.nome ?? o.chave,
        qtd: o.qtd,
        cor: corDaClasse.get(m?.classe ?? "outros"),
        detalhe: CLASSES.find((c) => c.id === (m?.classe ?? "outros"))?.rotulo,
      };
    });
  }, [d, pessoa, corDaClasse]);

  const empresas = useMemo<BarraItem[] | undefined>(
    () => (pessoa ? pessoa.topEmpresas : d?.empresas)?.map((e) => ({ ...e })),
    [d, pessoa]
  );

  const autores = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) {
      return d.autores.map((a) => ({
        chave: a.chave,
        nome: a.nome,
        qtd: a.qtd,
        detalhe:
          a.proprios > 0
            ? `${pctBR(pctDe(a.proprios, a.qtd))}% apagados por ela mesma`
            : "nenhum apagado por ela mesma",
      }));
    }
    return pessoa.autores.map((a) => ({
      chave: a.chave,
      nome: nomePorAutor.get(a.chave) ?? `Usuário ${a.chave}`,
      qtd: a.qtd,
      detalhe: a.chave === String(pessoa.codigo) ? "lançamento dela mesma" : undefined,
    }));
  }, [d, pessoa, nomePorAutor]);

  const serie = useMemo(() => {
    if (!d) return undefined;
    if (!pessoa) return d.serie.map((p) => ({ bucket: p.bucket, valor: p.total }));
    const mapa = new Map<string, number>();
    for (const dia of pessoa.serie) {
      const b = d.periodo.granularidade === "mes" ? dia.d.slice(0, 7) + "-01" : dia.d;
      mapa.set(b, (mapa.get(b) ?? 0) + dia.n);
    }
    return d.serie.map((p) => ({ bucket: p.bucket, valor: mapa.get(p.bucket) ?? 0 }));
  }, [d, pessoa]);

  const calendario = useMemo(() => {
    if (!d) return undefined;
    if (!pessoa) return d.calendario;
    return {
      inicio: d.periodo.inicio,
      fim: d.periodo.fim,
      celulas: pessoa.serie,
      total: pessoa.excluidos,
      pico: pico(pessoa.serie),
    };
  }, [d, pessoa]);

  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) =>
      `exclusoes-contabil-${corte}-${periodo}${doTime ? "" : alvo}`;
    const rotuloOrigem = new Map(d.origens.map((o) => [o.chave, o.nome]));

    return [
      {
        id: "pessoas",
        rotulo: "Quem excluiu",
        descricao: "Uma linha por pessoa — sempre o time inteiro",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Exclusões", "Próprias", "De outros",
            "Idade mediana (dias)", "Mais velho (dias)", "Empresas", "Dias", "Valor",
            ...FAIXAS_IDADE.map((f) => f.rotulo),
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.excluidos,
            p.proprios,
            p.excluidos - p.proprios,
            p.idadeMediana ?? "",
            p.idadeMaxima,
            p.empresas,
            p.dias,
            decimalBR(p.valor),
            ...p.porFaixa,
          ]),
        }),
      },
      {
        id: "autores",
        rotulo: pessoa ? `De quem ${pessoa.nome} apagou` : "De quem era o lançamento",
        descricao: "O outro lado da conta: quem tinha lançado o que foi apagado",
        nome: arquivo("autores"),
        montar: () => ({
          cabecalhos: ["Código", "Pessoa", "Exclusões"],
          linhas: (autores ?? []).map((a) => [a.chave, a.nome, a.qtd]),
        }),
      },
      {
        id: "origens",
        rotulo: pessoa ? `Origens de ${pessoa.nome}` : "Origens do time",
        descricao: "Que tipo de lançamento foi apagado",
        nome: arquivo("origens"),
        montar: () => ({
          cabecalhos: ["Código", "Origem", "Exclusões"],
          linhas: (origens ?? []).map((o) => [
            o.chave,
            rotuloOrigem.get(o.chave) ?? o.nome,
            o.qtd,
          ]),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        descricao: "Onde as exclusões aconteceram",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Exclusões", "Valor"],
          linhas: (pessoa ? pessoa.topEmpresas : d.empresas).map((e) => [
            e.chave,
            e.nome,
            e.qtd,
            decimalBR(e.valor),
          ]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        descricao: d.periodo.granularidade === "mes" ? "Um mês por linha" : "Um dia por linha",
        nome: arquivo("evolucao"),
        montar: () => ({
          cabecalhos: [d.periodo.granularidade === "mes" ? "Mês" : "Dia", "Exclusões"],
          linhas: (serie ?? []).map((p) => [dataBR(p.bucket), p.valor]),
        }),
      },
    ];
  }, [d, pessoa, autores, origens, serie]);

  const excluidos = pessoa ? pessoa.excluidos : (d?.totais.excluidos ?? 0);
  const valor = pessoa ? pessoa.valor : (d?.totais.valor ?? 0);
  const deOutros = pessoa ? pessoa.excluidos - pessoa.proprios : (d?.totais.deOutros ?? 0);
  const porFaixa = pessoa ? pessoa.porFaixa : d?.totais.porFaixa;
  const idadeMediana = pessoa ? pessoa.idadeMediana : (d?.totais.idadeMediana ?? null);
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ProdPessoaFiltro
          dados={opcoesPessoa}
          valor={pessoaSel}
          onMudar={setPessoaSel}
          rotuloTodos="Todo o time"
        />
        <span className="text-xs text-muted">
          {pessoa
            ? "Mostrando só o que esta pessoa apagou · o ranking segue com o time todo"
            : "Período pela data da exclusão · reimportar um mês apaga e regrava em lote"}
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
              rotulo="Exclusões"
              icon={<Eraser className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={numCompact(excluidos)}
              valorCheio={num(excluidos)}
              secundario={`${brlCompact(valor)} apagados`}
              delta={
                pessoa ? undefined : (
                  <Delta pct={deltaPct(d.totais.excluidos, d.anterior.excluidos)} bomQuandoSobe={false} />
                )
              }
            />
            {/* Sem pessoa escolhida, a régua é o que ENTROU no período: exclusões
                sobre lançamentos é a taxa de regravação do escritório. Com uma
                pessoa isolada essa conta perderia o sentido (numerador de uma,
                denominador de todos), então a régua vira a participação dela no
                que o time apagou. */}
            {pessoa ? (
              <StatTile
                rotulo="Participação"
                icon={<RotateCcw className="size-4 text-ent" />}
                iconTint="bg-ent/12"
                valor={`${pctBR(pctDe(excluidos, d.totais.excluidos))}%`}
                secundario={`de tudo que o time apagou (${numCompact(d.totais.excluidos)} exclusões)`}
              />
            ) : (
              <StatTile
                rotulo="Regravação"
                icon={<RotateCcw className="size-4 text-ent" />}
                iconTint="bg-ent/12"
                valor={`${pctBR(pctDe(excluidos, d.totais.lancados))}%`}
                secundario={`do que entrou no período (${numCompact(d.totais.lancados)} lançamentos)`}
              />
            )}
            <StatTile
              rotulo="De outra pessoa"
              icon={<UserMinus className="size-4 text-ink-2" />}
              valor={numCompact(deOutros)}
              valorCheio={num(deOutros)}
              secundario={`${pctBR(pctDe(deOutros, excluidos))}% do que foi apagado`}
            />
            <StatTile
              rotulo="Idade mediana"
              icon={<CalendarClock className="size-4 text-ink-2" />}
              valor={emDias(idadeMediana)}
              secundario="metade do apagado era mais velha que isto"
              alerta={(idadeMediana ?? 0) > 90}
            />
            <StatTile
              rotulo="Empresas atingidas"
              icon={<Building2 className="size-4 text-ink-2" />}
              valor={num(pessoa ? pessoa.empresas : d.totais.empresas)}
              secundario={
                <span className="line-clamp-2">
                  {(pessoa ? pessoa.topEmpresas[0] : d.empresas[0])?.nome ?? "sem exclusão"}
                </span>
              }
            />
          </>
        )}
      </div>

      <CtbEscada
        titulo="Idade do que foi apagado"
        subtitulo={`Quanto tempo o lançamento tinha quando foi excluído — ${escopo}. Apagar no mesmo dia é conserto; apagar mês fechado é outra conversa.`}
        faixas={FAIXAS_IDADE}
        valores={porFaixa}
        rotuloItem="exclusões"
        carregando={carregando || !d}
      />

      <CtbRankingTabela
        titulo="Quem excluiu"
        subtitulo="Clique numa pessoa para isolar o restante da tela · ordene por qualquer coluna"
        dados={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="excluidos"
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
        vazio="Ninguém apagou nada no período"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="De quem era o lançamento"
          subtitulo={
            pessoa
              ? `Os lançamentos que ${pessoa.nome} apagou, por quem os fez`
              : "Quem tinha lançado o que o time apagou"
          }
          dados={autores}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Autor do lançamento"
          corPadrao="var(--esp-4)"
        />
        <CtbProdBarras
          titulo="Por origem"
          subtitulo={`Que tipo de lançamento foi apagado ${escopo}`}
          dados={origens}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Origem do lançamento"
        />
      </div>

      <CtbProdBarras
        titulo="Por empresa"
        subtitulo={pessoa ? `Empresas em que ${pessoa.nome} apagou` : "Onde as exclusões aconteceram"}
        dados={empresas}
        carregando={carregando}
        recarregando={recarregando}
        rotuloEixo="Empresa"
      />

      <CtbSerieSimples
        titulo="Ritmo das exclusões"
        subtitulo={`Exclusões por ${d?.periodo.granularidade === "mes" ? "mês" : "dia"} — ${escopo}`}
        dados={serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        rotulo="Exclusões"
        cor="var(--esp-4)"
        carregando={carregando}
        recarregando={recarregando}
      />

      <CalendarioAtividade
        dados={calendario}
        carregando={carregando}
        recarregando={recarregando}
        subtitulo={`Exclusões por dia no período — ${pessoa ? pessoa.nome : "time todo"}`}
        rotuloItem="exclusões"
      />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.excluidos)} exclusões no
          lctoctbexcluido ({brl(d.totais.valor)}) · período pela data da exclusão
        </p>
      )}
    </div>
  );
}
