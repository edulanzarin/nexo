"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel, Par } from "@/componentes/primitivos/painel";
import {
  CLASSES_FAMILIA,
  COR_FAMILIA,
  PontoFamilia,
  porFamilia,
  rotuloFamilia,
  rotuloLinhas,
  somaFamilia,
} from "@/componentes/produto/folha/produtividade-familias";
import { QuemFezPorFamilia } from "@/componentes/produto/folha/produtividade-quem-fez";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { ComposicaoClasses } from "@/componentes/produto/produtividade/composicao-classes";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { ModalQuebra } from "@/componentes/produto/produtividade/modal-quebra";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { num, pct } from "@/lib/format";
import { pctDe, slug } from "@/lib/prod-formato";
import { DP_FAMILIAS, DP_TIPOS, infoDoTipo, type DpColaborador, type DpTipo } from "@/lib/dp-tipos";
import { ContraAnterior } from "./contra-anterior";
import { opcoesPessoa, periodoDoQs, situacaoPessoa, somaRanking, useResumoDp } from "./use-resumo-dp";

const total = (c: DpColaborador) => c.total;

/**
 * A coluna do ranking é a FAMÍLIA, não o trabalho: doze colunas não se leem de
 * lado a lado, e a pergunta do ranking é quem carregou o mês. O detalhe por
 * trabalho mora no Por Trabalho, nas abas de família e na exportação.
 */
function colunasRanking(soma: number): ColunaRanking<DpColaborador>[] {
  return [
    {
      id: "total",
      rotulo: "Total",
      dica: "A porcentagem é a parte da pessoa no que o time fez",
      valor: total,
      celula: (p) => (
        <>
          {num(p.total)} <span className="text-micro text-apagado">{pct(pctDe(p.total, soma))}</span>
        </>
      ),
      largura: "128px",
    },
    ...DP_FAMILIAS.map<ColunaRanking<DpColaborador>>((f) => ({
      id: f.id,
      rotulo: f.rotulo,
      cor: COR_FAMILIA[f.id],
      dica: f.descricao,
      valor: (p) => somaFamilia(p.porTipo, f.id),
    })),
  ];
}

/**
 * Visão Geral da Produtividade do DP: o que o time fez no período, por família
 * de trabalho e por pessoa. Uma consulta traz o ranking com os doze trabalhos
 * de cada pessoa, os totais e o período anterior; isolar alguém reprojeta o que
 * já está na memória.
 *
 * O Sistema (usuário 0, a rotina automática) entra no ranking e no total,
 * porque o volume é real, e fica fora da contagem de pessoas e das médias.
 */
export function Conteudo() {
  const { qs, consulta, d, pessoa, setPessoaSel } = useResumoDp();
  const carregando = !d;
  const [trabalhoAberto, setTrabalhoAberto] = useState<DpTipo | null>(null);

  // O Desligado do ranking é de gente: o Sistema não tem conta a baixar.
  const ranking = useMemo(() => d?.ranking.map((c) => ({ ...c, inativo: c.inativo && !c.auto })), [d]);
  const temSistema = !!d?.ranking.some((c) => c.auto && c.total > 0);
  // A média é de gente: o volume do Sistema conta no total, não na média.
  const mediaPessoa = d?.colaboradores
    ? Math.round(d.ranking.filter((c) => !c.auto).reduce((a, c) => a + c.total, 0) / d.colaboradores)
    : 0;

  const soma = useMemo(() => somaRanking(d?.ranking, total), [d]);
  const somaPorFamilia = useMemo(
    () =>
      Object.fromEntries(
        DP_FAMILIAS.map((f) => [f.id, somaRanking(d?.ranking, (c) => somaFamilia(c.porTipo, f.id))])
      ) as Record<string, number>,
    [d]
  );
  const colunas = useMemo(() => colunasRanking(soma), [soma]);

  const por = pessoa ? pessoa.porTipo : d?.totais.porTipo;
  const totalAtual = pessoa ? pessoa.total : (d?.totais.total ?? 0);
  const familias = useMemo(() => porFamilia(por), [por]);
  const escopo = pessoa ? pessoa.nome : "Time todo";

  // Os doze trabalhos na ordem do catálogo, agrupados por família: a leitura é
  // "de que é feita cada família", e ordenar por volume espalharia o grupo.
  const trabalhos = useMemo<ItemQuebra[] | undefined>(
    () =>
      por &&
      DP_TIPOS.map((t) => ({
        chave: t.id,
        nome: t.rotulo,
        qtd: por[t.id],
        cor: COR_FAMILIA[t.familia],
        detalhe: `${rotuloFamilia(t.familia)} · ${pct(pctDe(por[t.id], totalAtual))}`,
      })),
    [por, totalAtual]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d || qs == null) return [];
    const periodo = periodoDoQs(qs);
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) => `produtividade-dp-${corte}-${periodo}${doTime ? "" : alvo}`;
    return [
      {
        id: "pessoas",
        rotulo: "Ranking do DP",
        descricao: "Uma coluna por família e por trabalho",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código",
            "Pessoa",
            "Situação",
            "Total",
            ...DP_FAMILIAS.map((f) => f.rotulo),
            ...DP_TIPOS.map((t) => t.rotulo),
          ],
          linhas: d.ranking.map((c) => [
            c.codigo,
            c.nome,
            situacaoPessoa(c),
            c.total,
            ...DP_FAMILIAS.map((f) => somaFamilia(c.porTipo, f.id)),
            ...DP_TIPOS.map((t) => c.porTipo[t.id]),
          ]),
        }),
      },
      {
        id: "familias",
        rotulo: pessoa ? `Famílias de ${pessoa.nome}` : "Por família",
        nome: arquivo("familias"),
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Família", "Quantidade"],
                linhas: DP_FAMILIAS.map((f) => [f.rotulo, somaFamilia(pessoa.porTipo, f.id)]),
              }
            : {
                cabecalhos: ["Família", "Quantidade", "Período anterior"],
                linhas: DP_FAMILIAS.map((f) => [
                  f.rotulo,
                  somaFamilia(d.totais.porTipo, f.id),
                  somaFamilia(d.anterior.porTipo, f.id),
                ]),
              },
      },
      {
        id: "trabalhos",
        rotulo: pessoa ? `Trabalhos de ${pessoa.nome}` : "Por trabalho",
        nome: arquivo("trabalhos"),
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Família", "Trabalho", "Quantidade"],
                linhas: DP_TIPOS.map((t) => [rotuloFamilia(t.familia), t.rotulo, pessoa.porTipo[t.id]]),
              }
            : {
                cabecalhos: ["Família", "Trabalho", "Quantidade", "Linhas no Questor", "Período anterior"],
                linhas: DP_TIPOS.map((t) => [
                  rotuloFamilia(t.familia),
                  t.rotulo,
                  d.totais.porTipo[t.id],
                  d.totais.linhas[t.id],
                  d.anterior.porTipo[t.id],
                ]),
              },
      },
    ];
  }, [d, pessoa, qs]);

  const infoAberto = trabalhoAberto ? infoDoTipo(trabalhoAberto) : undefined;
  const quemFezTrabalho = useMemo(
    () =>
      trabalhoAberto == null || !d
        ? []
        : d.ranking
            .map((c) => ({ codigo: c.codigo, nome: c.nome, qtd: c.porTipo[trabalhoAberto] }))
            .filter((c) => c.qtd > 0)
            .sort((a, b) => b.qtd - a.qtd),
    [d, trabalhoAberto]
  );

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroPessoa
        pessoas={opcoesPessoa(d?.ranking, total)}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        desabilitado={carregando}
      />
      <MenuExportar modulo="folha" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.total === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="velocimetro"
            titulo="Ninguém do DP lançou trabalho no período"
            descricao="Amplie o período ou tire o filtro de empresa no topo."
          />
        </div>
      </>
    );

  return (
    <>
      {acoes}

      {/* Duas faixas: sete números numa só cortavam a comparação com o anterior. */}
      <FaixaIndicadores colunas={3}>
        <Indicador
          rotulo="Total no período"
          icone="atividade"
          carregando={carregando}
          valor={num(totalAtual)}
          detalhe={
            pessoa ? (
              `${pct(pctDe(pessoa.total, soma))} do time`
            ) : d ? (
              <ContraAnterior atual={d.totais.total} anterior={d.anterior.total} />
            ) : undefined
          }
        />
        <Indicador
          rotulo="Pessoas do DP"
          icone="pessoas"
          carregando={carregando}
          valor={num(d?.colaboradores ?? 0)}
          detalhe={temSistema ? "Sem contar o Sistema" : "Com trabalho no período"}
        />
        <Indicador
          rotulo="Média por pessoa"
          icone="grafico"
          carregando={carregando}
          valor={num(mediaPessoa)}
          detalhe={temSistema ? "Trabalhos do time, sem o Sistema" : "Trabalhos do time"}
        />
      </FaixaIndicadores>

      <FaixaIndicadores colunas={5}>
        {DP_FAMILIAS.map((f) => (
          <Indicador
            key={f.id}
            rotulo={
              <>
                <PontoFamilia familia={f.id} className="mr-1.5" />
                {f.rotulo}
              </>
            }
            carregando={carregando}
            valor={num(familias[f.id])}
            detalhe={
              pessoa ? (
                `${pct(pctDe(familias[f.id], somaPorFamilia[f.id]))} do time`
              ) : d ? (
                <ContraAnterior atual={familias[f.id]} anterior={somaFamilia(d.anterior.porTipo, f.id)} />
              ) : undefined
            }
          />
        ))}
      </FaixaIndicadores>

      <div className="flex flex-col gap-1">
        <Nota>
          Período pela data em que o trabalho foi lançado no Questor. Uma rescisão de julho calculada em agosto conta em
          agosto.
        </Nota>
        <Nota>
          Folha calculada, encargos, provisão e eSocial contam uma vez por empresa a cada rodada, com qualquer número de
          funcionários.
        </Nota>
      </div>

      <Painel titulo="Por Família" descricao={pessoa ? `Trabalho de ${pessoa.nome}` : "Trabalho do time"}>
        {d ? (
          <ComposicaoClasses classes={CLASSES_FAMILIA} porClasse={familias} total={totalAtual} />
        ) : (
          <Esqueleto className="h-20 w-full" />
        )}
      </Painel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Por Trabalho"
          descricao={`Agrupados por família · ${escopo}`}
          itens={trabalhos}
          limite={DP_TIPOS.length}
          carregando={carregando}
          aoClicar={(i) => setTrabalhoAberto(i.chave as DpTipo)}
          selecionado={trabalhoAberto}
        />
        <QuemFezPorFamilia
          descricao={pessoa ? "Clique de novo para voltar ao time" : "Clique numa pessoa para isolar o resto da tela"}
          pessoas={ranking}
          carregando={carregando}
          selecionada={pessoa ? pessoa.codigo : null}
          onSelecionar={setPessoaSel}
        />
      </div>

      <RankingPessoas
        titulo="Ranking do DP"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
        linhas={ranking}
        colunas={colunas}
        ordemInicial="total"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém do DP lançou trabalho no período."
        rodape={
          temSistema ? (
            <Nota>O Sistema é a rotina automática do Questor. Conta no total e fica fora da contagem de pessoas.</Nota>
          ) : undefined
        }
      />

      {/* O detalhe de um trabalho: os números do time e quem o fez, tirado do
          ranking na memória. Escolher alguém ali isola a pessoa na tela. */}
      <ModalQuebra
        aberto={infoAberto != null}
        onFechar={() => setTrabalhoAberto(null)}
        titulo={infoAberto?.rotulo ?? ""}
        descricao={infoAberto?.descricao}
        rotuloPessoas="Quem fez este trabalho"
        fatos={
          infoAberto &&
          d && (
            <>
              <Par rotulo="Família">
                <span className="inline-flex items-center gap-1.5">
                  <PontoFamilia familia={infoAberto.familia} />
                  {rotuloFamilia(infoAberto.familia)}
                </span>
              </Par>
              <Par rotulo="No período">
                <span className="num font-[600]">{num(d.totais.porTipo[infoAberto.id])}</span>
              </Par>
              <Par rotulo="Período anterior">
                <span className="num">{num(d.anterior.porTipo[infoAberto.id])}</span>{" "}
                <Variacao atual={d.totais.porTipo[infoAberto.id]} anterior={d.anterior.porTipo[infoAberto.id]} />
              </Par>
              {infoAberto.gesto ? (
                <Par rotulo={rotuloLinhas(infoAberto)}>
                  <span className="num">{num(d.totais.linhas[infoAberto.id])}</span>
                </Par>
              ) : (
                <Par rotulo="Pessoas">
                  <span className="num">{num(quemFezTrabalho.filter((c) => c.codigo !== 0).length)}</span>
                </Par>
              )}
            </>
          )
        }
        pessoas={quemFezTrabalho}
        onIsolar={setPessoaSel}
      />
    </>
  );
}
