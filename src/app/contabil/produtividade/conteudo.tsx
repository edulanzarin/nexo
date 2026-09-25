"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { ComposicaoClasses } from "@/componentes/produto/produtividade/composicao-classes";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { HorasDoDia } from "@/componentes/produto/produtividade/horas-do-dia";
import { ModalQuebra } from "@/componentes/produto/produtividade/modal-quebra";
import { PainelCalendario } from "@/componentes/produto/produtividade/painel-calendario";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import {
  calendarioDe,
  nomeGranularidade,
  rotuloBucketLongo,
  rotuloHora,
  totalPorBucket,
} from "@/componentes/produto/produtividade/recorte";
import { SerieClasses } from "@/componentes/produto/produtividade/serie-periodo";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, dataBR, num, pct } from "@/lib/format";
import { pctDe, slug } from "@/lib/prod-formato";
import type { SeriePontoGen } from "@/lib/prod-tipos";
import {
  CLASSES,
  zeroClasses,
  type ClasseOrigem,
  type ContabilProdutividadeResp,
  type CtbPessoa,
} from "@/lib/contabil-produtividade-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const CLASSE = new Map(CLASSES.map((c) => [c.id, c]));
const cor = (id: ClasseOrigem) => CLASSE.get(id)?.cor;

const COLUNAS: ColunaRanking<CtbPessoa>[] = [
  { id: "lancamentos", rotulo: "Lançamentos", valor: (p) => p.lancamentos },
  { id: "digitado", rotulo: "Digitado", cor: cor("digitado"), dica: "Lançado a dedo na Contabilidade", valor: (p) => p.porClasse.digitado },
  { id: "importado", rotulo: "Importado", cor: cor("importado"), dica: "Importação e conciliação", valor: (p) => p.porClasse.importado },
  { id: "integrado", rotulo: "Integrado", cor: cor("integrado"), dica: "Veio de outro módulo do Questor", valor: (p) => p.porClasse.integrado },
  {
    id: "apuracao",
    rotulo: "Apuração",
    cor: cor("apuracao"),
    dica: "Zeramento, extemporâneo, Lalur, saldo inicial",
    valor: (p) => p.porClasse.apuracao,
    secundaria: true,
  },
  { id: "rodadas", rotulo: "Rodadas", dica: "Empresa × dia × origem: quantas vezes sentou e rodou", valor: (p) => p.rodadas },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { id: "dias", rotulo: "Dias", dica: "Dias com algum lançamento", valor: (p) => p.diasAtivos, secundaria: true },
  {
    id: "ultimo",
    rotulo: "Último",
    dica: "Último dia com lançamento",
    valor: (p) => (p.ultimo ? Date.parse(p.ultimo) : 0),
    celula: (p) => dataBR(p.ultimo),
    largura: "104px",
    secundaria: true,
  },
  { id: "valor", rotulo: "Valor", valor: (p) => p.valor, celula: (p) => brlCompact(p.valor), largura: "104px" },
];

/**
 * Lançamentos: quem alimentou a contabilidade no período, por pessoa, origem,
 * empresa, dia e hora. Uma consulta ao `lctoctb` traz tudo; isolar uma pessoa
 * reprojeta o que já está na memória.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<ContabilProdutividadeResp>(
    "contabil-produtividade",
    qs == null ? null : `/api/contabil/produtividade?${qs}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [pessoaSel, setPessoaSel] = useEstadoTela<number | null>("pessoa", null);
  const [origemAberta, setOrigemAberta] = useState<string | null>(null);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  // Origens do time, ou só da pessoa isolada (o nome e a natureza vêm do time).
  const origens = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa)
      return d.origens.map((o) => ({
        chave: o.chave,
        nome: o.nome,
        qtd: o.qtd,
        cor: cor(o.classe),
        detalhe: `${num(o.pessoas)} ${o.pessoas === 1 ? "pessoa" : "pessoas"} · ${brlCompact(o.valor)}`,
      }));
    const meta = new Map(d.origens.map((o) => [o.chave, o]));
    return pessoa.origens.map((o) => {
      const classe = meta.get(o.chave)?.classe ?? "outros";
      // Valor por origem não é guardado por pessoa (só por empresa): some da
      // linha em vez de virar um R$ 0,00 falso.
      return { chave: o.chave, nome: meta.get(o.chave)?.nome ?? o.chave, qtd: o.qtd, cor: cor(classe), detalhe: CLASSE.get(classe)?.rotulo };
    });
  }, [d, pessoa]);

  const empresas = useMemo<ItemQuebra[] | undefined>(
    () =>
      (pessoa ? pessoa.topEmpresas : d?.empresas)?.map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: e.qtd,
        detalhe: brlCompact(e.valor),
      })),
    [d, pessoa]
  );

  const serie = useMemo<SeriePontoGen[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) return d.serie;
    return totalPorBucket(
      pessoa.serie,
      d.serie.map((p) => p.bucket),
      d.periodo.granularidade
    );
  }, [d, pessoa]);

  const calendario = useMemo(
    () => (d ? (pessoa ? calendarioDe(d.periodo, pessoa.serie, pessoa.lancamentos) : d.calendario) : undefined),
    [d, pessoa]
  );

  // Exportação: os mesmos cortes da tela, com o recorte ativo aplicado. O
  // ranking e o cruzamento pessoa × origem saem sempre com o time inteiro.
  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) => `produtividade-contabil-${corte}-${periodo}${doTime ? "" : alvo}`;
    const meta = new Map(d.origens.map((o) => [o.chave, o]));
    const natureza = (chave: string) => CLASSE.get(meta.get(chave)?.classe ?? "outros")?.rotulo ?? "";
    const g = d.periodo.granularidade;
    return [
      {
        id: "pessoas",
        rotulo: "Ranking de pessoas",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Lançamentos", "Digitado", "Importado", "Integrado", "Apuração",
            "Outros", "Rodadas", "Empresas", "Dias ativos", "Último lançamento", "Valor",
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.lancamentos,
            p.porClasse.digitado,
            p.porClasse.importado,
            p.porClasse.integrado,
            p.porClasse.apuracao,
            p.porClasse.outros,
            p.rodadas,
            p.empresas,
            p.diasAtivos,
            p.ultimo ? dataBR(p.ultimo) : "",
            decimalBR(p.valor),
          ]),
        }),
      },
      {
        id: "pessoa-origem",
        rotulo: "Pessoa × origem",
        nome: arquivo("pessoa-origem", true),
        montar: () => ({
          cabecalhos: ["Pessoa", "Código da origem", "Origem", "Natureza", "Lançamentos"],
          linhas: d.ranking.flatMap((p) =>
            p.origens.map((o) => [p.nome, o.chave, meta.get(o.chave)?.nome ?? o.chave, natureza(o.chave), o.qtd])
          ),
        }),
      },
      {
        id: "origens",
        rotulo: pessoa ? `Origens de ${pessoa.nome}` : "Origens do time",
        nome: arquivo("origens"),
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Código", "Origem", "Natureza", "Lançamentos"],
                linhas: pessoa.origens.map((o) => [o.chave, meta.get(o.chave)?.nome ?? o.chave, natureza(o.chave), o.qtd]),
              }
            : {
                cabecalhos: ["Código", "Origem", "Natureza", "Lançamentos", "Pessoas", "Valor"],
                linhas: d.origens.map((o) => [o.chave, o.nome, natureza(o.chave), o.qtd, o.pessoas, decimalBR(o.valor)]),
              },
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Lançamentos", "Valor"],
          linhas: (pessoa ? pessoa.topEmpresas : d.empresas).map((e) => [e.chave, e.nome, e.qtd, decimalBR(e.valor)]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        nome: arquivo("evolucao"),
        montar: () => ({
          cabecalhos: pessoa
            ? [g === "mes" ? "Mês" : "Dia", "Lançamentos"]
            : [g === "mes" ? "Mês" : "Dia", "Total", ...CLASSES.map((c) => c.rotulo)],
          linhas: (serie ?? []).map((p) => [
            rotuloBucketLongo(p.bucket, g),
            p.total,
            ...(pessoa ? [] : CLASSES.map((c) => Number(p[c.id] ?? 0))),
          ]),
        }),
      },
      {
        id: "horas",
        rotulo: "Por hora do dia",
        nome: arquivo("horas"),
        montar: () => ({
          cabecalhos: ["Hora", "Lançamentos"],
          linhas: (pessoa ? pessoa.porHora : d.porHora).map((n, h) => [rotuloHora(h), n]),
        }),
      },
    ];
  }, [d, pessoa, serie]);

  const origemDetalhe = origemAberta != null ? d?.origens.find((o) => o.chave === origemAberta) : undefined;
  const quemUsou = useMemo(
    () =>
      origemAberta == null || !d
        ? []
        : d.ranking
            .map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.origens.find((o) => o.chave === origemAberta)?.qtd ?? 0 }))
            .filter((p) => p.qtd > 0)
            .sort((a, b) => b.qtd - a.qtd),
    [d, origemAberta]
  );

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.lancamentos, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        desabilitado={carregando}
      />
      <MenuExportar modulo="contabil" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.lancamentos === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="nota"
            titulo="Ninguém lançou nada no período"
            descricao="Amplie o período ou tire o filtro de empresa no topo."
          />
        </div>
      </>
    );

  const lancamentos = pessoa ? pessoa.lancamentos : (d?.totais.lancamentos ?? 0);
  const valor = pessoa ? pessoa.valor : (d?.totais.valor ?? 0);
  const porClasse = pessoa ? pessoa.porClasse : (d?.totais.porClasse ?? zeroClasses());
  const escopo = pessoa ? pessoa.nome : "Time todo";
  const g = d?.periodo.granularidade ?? "dia";
  const topEmpresa = (pessoa ? pessoa.topEmpresas[0] : d?.empresas[0])?.nome;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Lançamentos"
          icone="nota"
          carregando={carregando}
          valor={num(lancamentos)}
          detalhe={
            <>
              {!pessoa && d && <Variacao atual={d.totais.lancamentos} anterior={d.anterior.lancamentos} />}
              {!pessoa && d && d.anterior.lancamentos > 0 && " · "}
              {brlCompact(valor)} movimentados
            </>
          }
        />
        <Indicador
          rotulo="Digitado a dedo"
          icone="editar"
          carregando={carregando}
          valor={num(porClasse.digitado)}
          detalhe={`${pct(pctDe(porClasse.digitado, lancamentos))} do total`}
        />
        <Indicador
          rotulo="Pessoas no período"
          icone="pessoas"
          carregando={carregando}
          valor={num(pessoa ? 1 : (d?.totais.pessoas ?? 0))}
          detalhe={
            pessoa
              ? `${num(pessoa.diasAtivos)} dias com lançamento`
              : `${num(d?.totais.diasAtivos ?? 0)} dias com movimento`
          }
        />
        <Indicador
          rotulo="Empresas atendidas"
          icone="empresa"
          carregando={carregando}
          valor={num(pessoa ? pessoa.empresas : (d?.totais.empresas ?? 0))}
          detalhe={topEmpresa ?? "Sem movimento"}
        />
        <Indicador
          rotulo="Rodadas"
          icone="atualizar"
          carregando={carregando}
          valor={num(pessoa ? pessoa.rodadas : (d?.totais.rodadas ?? 0))}
          detalhe="Empresa × dia × origem"
        />
      </FaixaIndicadores>

      <Nota>Período pela data em que o lançamento foi feito, não pela data do fato.</Nota>

      <Painel titulo="Por Natureza" descricao={pessoa ? `Lançamentos de ${pessoa.nome}` : "Lançamentos do time"}>
        {d ? (
          <ComposicaoClasses classes={CLASSES} porClasse={porClasse} total={lancamentos} ocultarVazio={["outros"]} />
        ) : (
          <Esqueleto className="h-20 w-full" />
        )}
      </Painel>

      <RankingPessoas
        titulo="Quem Lançou"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="lancamentos"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém lançou nada no período."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Por Origem"
          descricao={`De onde vieram os lançamentos · ${escopo}`}
          itens={origens}
          carregando={carregando}
          aoClicar={(i) => setOrigemAberta(i.chave)}
          selecionado={origemAberta}
        />
        <PainelQuebra
          titulo="Por Empresa"
          descricao={pessoa ? `Empresas atendidas por ${pessoa.nome}` : "Onde o trabalho aconteceu"}
          itens={empresas}
          carregando={carregando}
        />
      </div>

      <SerieClasses
        pontos={serie}
        classes={CLASSES}
        granularidade={g}
        soTotal={!!pessoa}
        rotuloItem="Lançamentos"
        descricao={
          pessoa
            ? `Lançamentos de ${pessoa.nome} por ${nomeGranularidade(g)}`
            : `Lançamentos por ${nomeGranularidade(g)}, por natureza`
        }
        carregando={carregando}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HorasDoDia
          porHora={pessoa ? pessoa.porHora : d?.porHora}
          rotuloItem="Lançamentos"
          descricao={`Lançamentos por hora do dia · ${escopo}`}
          carregando={carregando}
        />
        <PainelCalendario
          calendario={calendario}
          rotuloItem="Lançamentos"
          descricao={`Lançamentos por dia · ${escopo}`}
          carregando={carregando}
        />
      </div>

      <ModalQuebra
        aberto={origemDetalhe != null}
        onFechar={() => setOrigemAberta(null)}
        titulo={origemDetalhe?.nome ?? ""}
        descricao={origemDetalhe ? CLASSE.get(origemDetalhe.classe)?.descricao : undefined}
        rotuloPessoas="Quem usou esta origem"
        fatos={
          origemDetalhe && (
            <>
              <Par rotulo="Código">
                <span className="num">{origemDetalhe.chave}</span>
              </Par>
              <Par rotulo="Natureza">{CLASSE.get(origemDetalhe.classe)?.rotulo}</Par>
              <Par rotulo="Lançamentos">
                <span className="num font-[600]">{num(origemDetalhe.qtd)}</span>
              </Par>
              <Par rotulo="Valor">
                <span className="num">{brl(origemDetalhe.valor)}</span>
              </Par>
            </>
          )
        }
        pessoas={quemUsou}
        onIsolar={setPessoaSel}
      />
    </>
  );
}
