"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { FiltroEspecies, useEspecies } from "@/componentes/produto/fiscal/filtros";
import { CaixaGrafico, GraficoSerie, Legenda } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { ComposicaoClasses } from "@/componentes/produto/produtividade/composicao-classes";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import { nomeGranularidade, rotuloBucketLongo } from "@/componentes/produto/produtividade/recorte";
import { GraficoPeriodo } from "@/componentes/produto/produtividade/serie-periodo";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, num, pct } from "@/lib/format";
import { pctDe, slug } from "@/lib/prod-formato";
import type { ClasseInfo, PorClasseGen } from "@/lib/prod-tipos";
import {
  TRIBUTOS,
  type FiscalImpostosResp,
  type FisImpPessoa,
  type FisTributoItem,
} from "@/lib/fiscal-impostos-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const TRIBUTO = new Map(TRIBUTOS.map((t) => [t.id, t]));

const COR_ENTRADAS = "var(--ent)";
const COR_SAIDAS = "var(--sai)";

/** Os três tributos de maior peso ficam sempre; o resto some abaixo de 900px. */
const TRIBUTOS_FIXOS = 3;

/**
 * As colunas saem dos tributos que existem no período: coluna de IPI zerada
 * para uma carteira sem indústria só empurra a tabela para o lado.
 */
function colunasDe(tributos: FisTributoItem[]): ColunaRanking<FisImpPessoa>[] {
  const porPeso = [...tributos].sort((a, b) => b.total - a.total);
  return [
    {
      id: "total",
      rotulo: "Tributo total",
      dica: "Soma dos tributos das notas que a pessoa escriturou",
      valor: (p) => p.total,
      celula: (p) => brlCompact(p.total),
      largura: "112px",
    },
    ...porPeso.map<ColunaRanking<FisImpPessoa>>((t, i) => ({
      id: t.id,
      rotulo: t.rotulo,
      cor: t.cor,
      dica: TRIBUTO.get(t.id)?.descricao,
      valor: (p) => p.porTributo[t.id] ?? 0,
      celula: (p) => brlCompact(p.porTributo[t.id] ?? 0),
      secundaria: i >= TRIBUTOS_FIXOS,
    })),
    { id: "notas", rotulo: "Notas", valor: (p) => p.notas },
    {
      id: "porNota",
      rotulo: "Por nota",
      dica: "Tributo médio de cada nota escriturada",
      valor: (p) => p.porNota,
      celula: (p) => brlCompact(p.porNota),
    },
    { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas, secundaria: true },
  ];
}

/**
 * Impostos: o PESO do que cada pessoa escriturou. Mil NFC-e de padaria e mil
 * NF-e de indústria são o mesmo número na aba Lançamentos e coisas muito
 * diferentes aqui.
 *
 * Entrada e saída ficam lado a lado e nunca se subtraem: débito menos crédito
 * pareceria apuração sem ser (faltam os ajustes e estornos do E110), e número
 * que parece oficial e não é engana mais do que a ausência dele.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const { especies: filtroEspecies, comEspecies } = useEspecies();
  const consulta = useConsulta<FiscalImpostosResp>(
    "fiscal-produtividade-impostos",
    qs == null ? null : `/api/fiscal/produtividade-impostos?${comEspecies(qs)}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [pessoaSel, setPessoaSel] = useEstadoTela<number | null>("pessoa", null);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const colunas = useMemo(() => colunasDe(d?.tributos ?? []), [d]);

  // Só os tributos que existem no período entram na composição: degrau zerado
  // aqui é tributo que a carteira não tem, e não diria nada.
  const classes = useMemo<ClasseInfo[]>(
    () =>
      (d?.tributos ?? []).map((t) => ({
        id: t.id,
        rotulo: t.rotulo,
        descricao: TRIBUTO.get(t.id)?.descricao ?? "",
        cor: t.cor,
      })),
    [d]
  );

  const porTributo = useMemo<PorClasseGen>(() => {
    if (!d) return {};
    if (pessoa) return pessoa.porTributo;
    return Object.fromEntries(d.tributos.map((t) => [t.id, t.total]));
  }, [d, pessoa]);

  // A pessoa guarda o tributo de cada empresa, mas não quantas notas: a linha
  // dela fica só com o valor em vez de um "0 notas" falso.
  const empresas = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (pessoa) return pessoa.topEmpresas.map((e) => ({ chave: e.chave, nome: e.nome, qtd: e.valor }));
    return d.empresas.map((e) => ({
      chave: e.chave,
      nome: e.nome,
      qtd: e.valor,
      detalhe: `${num(e.qtd)} notas · ${num(e.pessoas)} ${e.pessoas === 1 ? "pessoa" : "pessoas"}`,
    }));
  }, [d, pessoa]);

  const lados = useMemo(
    () => (d?.tributos ?? []).map((t) => ({ rotulo: t.rotulo, entradas: t.entradas, saidas: t.saidas })),
    [d]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const g = d.periodo.granularidade;
    return [
      {
        id: "pessoas",
        rotulo: "Tributo por pessoa",
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
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Tributo por empresa",
        nome: `impostos-fiscal-empresas-${periodo}${alvo}`,
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Código", "Empresa", "Tributo"],
                linhas: pessoa.topEmpresas.map((e) => [e.chave, e.nome, decimalBR(e.valor)]),
              }
            : {
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
              },
      },
      {
        id: "tributos",
        rotulo: pessoa ? `Tributos de ${pessoa.nome}` : "Entradas e saídas por tributo",
        nome: `impostos-fiscal-tributos-${periodo}${alvo}`,
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Tributo", "Valor"],
                linhas: d.tributos.map((t) => [t.rotulo, decimalBR(pessoa.porTributo[t.id] ?? 0)]),
              }
            : {
                cabecalhos: ["Tributo", "Entradas", "Saídas", "Total"],
                linhas: d.tributos.map((t) => [t.rotulo, decimalBR(t.entradas), decimalBR(t.saidas), decimalBR(t.total)]),
              },
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        nome: `impostos-fiscal-evolucao-${periodo}`,
        montar: () => ({
          cabecalhos: [g === "mes" ? "Mês" : "Dia", "Total", ...d.tributos.map((t) => t.rotulo)],
          linhas: d.serie.map((p) => [
            rotuloBucketLongo(p.bucket, g),
            decimalBR(p.total),
            ...d.tributos.map((t) => decimalBR(Number(p[t.id] ?? 0))),
          ]),
        }),
      },
    ];
  }, [d, pessoa]);

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroEspecies />
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.total, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        formatarQtd={brlCompact}
        desabilitado={carregando}
      />
      <MenuExportar modulo="fiscal" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.notas === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="moedas"
            titulo="Nenhuma nota escriturada no período"
            descricao={
              filtroEspecies.length
                ? "Tire o filtro de espécie, amplie o período ou tire o filtro de empresa no topo."
                : "Amplie o período ou tire o filtro de empresa no topo."
            }
          />
        </div>
      </>
    );

  const total = pessoa ? pessoa.total : (d?.totais.total ?? 0);
  const notas = pessoa ? pessoa.notas : (d?.totais.notas ?? 0);
  const entradas = pessoa ? pessoa.entradas : (d?.totais.entradas ?? 0);
  const saidas = pessoa ? pessoa.saidas : (d?.totais.saidas ?? 0);
  const porNota = pessoa ? pessoa.porNota : notas > 0 ? total / notas : 0;
  const g = d?.periodo.granularidade ?? "dia";

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Tributo escriturado"
          icone="moedas"
          carregando={carregando}
          valor={brlCompact(total)}
          detalhe={pessoa || !d ? `em ${num(notas)} notas` : `em ${num(notas)} notas de ${brlCompact(d.totais.valor)}`}
        />
        <Indicador
          rotulo="Nas entradas"
          icone="seta-baixo"
          carregando={carregando}
          valor={brlCompact(entradas)}
          detalhe={`${pct(pctDe(entradas, total))} do tributo`}
        />
        <Indicador
          rotulo="Nas saídas"
          icone="seta-cima"
          carregando={carregando}
          valor={brlCompact(saidas)}
          detalhe={`${pct(pctDe(saidas, total))} do tributo`}
        />
        <Indicador
          rotulo="Tributo por nota"
          icone="balanca"
          carregando={carregando}
          valor={brl(porNota)}
          detalhe="Média de cada nota escriturada"
        />
        <Indicador
          rotulo="Pessoas no período"
          icone="pessoas"
          carregando={carregando}
          valor={num(pessoa ? 1 : (d?.totais.pessoas ?? 0))}
          detalhe={`${num(pessoa ? pessoa.empresas : (d?.totais.empresas ?? 0))} empresas atendidas`}
        />
      </FaixaIndicadores>

      <div className="flex flex-col gap-1">
        <Nota>
          Tributo destacado nas notas escrituradas no período. Entrada e saída somam sem compensação, e o total não é o
          imposto a recolher.
        </Nota>
        {pessoa && <Nota>Entradas e saídas por tributo e a série seguem com o time todo.</Nota>}
      </div>

      <Painel titulo="Por Tributo" descricao={pessoa ? `Tributo das notas de ${pessoa.nome}` : "Tributo das notas do time"}>
        {d ? (
          <ComposicaoClasses classes={classes} porClasse={porTributo} total={total} formatar={brlCompact} />
        ) : (
          <Esqueleto className="h-20 w-full" />
        )}
      </Painel>

      <RankingPessoas
        titulo="Tributo por Pessoa"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
        linhas={d?.ranking}
        colunas={colunas}
        ordemInicial="total"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Nenhuma nota com tributo no período."
        rodape={<Nota>Muita nota com pouco tributo costuma ser varejo. Para comparar pessoas, leia a coluna Por nota.</Nota>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CaixaGrafico
          titulo="Entradas e Saídas por Tributo"
          descricao="Reais de cada lado · Time todo"
          carregando={carregando}
          altura={440}
          vazio={lados.length === 0 ? "Nenhum tributo nas notas do período." : false}
          legenda={
            <Legenda
              itens={[
                { rotulo: "Entradas", cor: COR_ENTRADAS },
                { rotulo: "Saídas", cor: COR_SAIDAS },
              ]}
            />
          }
        >
          <GraficoSerie
            dados={lados}
            x="rotulo"
            series={[
              { chave: "entradas", rotulo: "Entradas", cor: COR_ENTRADAS, tipo: "barra" },
              { chave: "saidas", rotulo: "Saídas", cor: COR_SAIDAS, tipo: "barra" },
            ]}
            formatar={(v) => brl(v)}
          />
        </CaixaGrafico>

        <PainelQuebra
          titulo="Por Empresa"
          descricao={pessoa ? `Empresas de ${pessoa.nome}` : "Onde está o peso fiscal da carteira"}
          itens={empresas}
          formatar={brlCompact}
          carregando={carregando}
          vazio="Nenhuma empresa com tributo no período."
        />
      </div>

      <CaixaGrafico
        titulo="Tributo no Período"
        descricao={`Reais por ${nomeGranularidade(g)}, por tributo · Time todo`}
        carregando={carregando}
        vazio={d && d.serie.every((p) => p.total === 0) ? "Nenhum tributo no período." : false}
        legenda={classes.length > 0 ? <Legenda itens={classes.map((c) => ({ rotulo: c.rotulo, cor: c.cor }))} /> : undefined}
        altura={260}
      >
        <GraficoPeriodo
          pontos={d?.serie ?? []}
          granularidade={g}
          series={classes.map((c) => ({ chave: c.id, rotulo: c.rotulo, cor: c.cor, tipo: "barra", pilha: "tributo" }))}
          formatar={(v) => brl(v)}
        />
      </CaixaGrafico>
    </>
  );
}
