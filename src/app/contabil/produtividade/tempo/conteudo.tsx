"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { CaixaGrafico, GraficoDispersao } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import { nomeGranularidade, rotuloBucketLongo } from "@/componentes/produto/produtividade/recorte";
import { GraficoPeriodo } from "@/componentes/produto/produtividade/serie-periodo";
import { decimalBR } from "@/lib/csv";
import { decimal, horas, num, numCompact } from "@/lib/format";
import { slug } from "@/lib/prod-formato";
import type { ContabilTempoResp, CtbTempoPessoa } from "@/lib/contabil-tempo-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const COR_TEMPO = "var(--serie-1)";
const COR_ISOLADA = "var(--serie-2)";

const COLUNAS: ColunaRanking<CtbTempoPessoa>[] = [
  { id: "horas", rotulo: "Horas", valor: (p) => p.horas, celula: (p) => horas(p.horas) },
  { id: "dias", rotulo: "Dias", dica: "Dias com algum tempo registrado", valor: (p) => p.dias },
  { id: "horasPorDia", rotulo: "Horas por dia", valor: (p) => p.horasPorDia, celula: (p) => horas(p.horasPorDia), secundaria: true },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { id: "lancamentos", rotulo: "Lançamentos", valor: (p) => p.lancamentos },
  {
    id: "porHora",
    rotulo: "Lançamentos por hora",
    // Ritmo BRUTO: a importação fiscal grava em lote sem consumir hora humana,
    // então o número absoluto infla. Serve para comparar pessoas entre si.
    dica: "Compara pessoas entre si. O número absoluto infla com importação em lote.",
    valor: (p) => p.porHora,
    celula: (p) => decimal(p.porHora),
  },
];

/**
 * Tempo: quanto cada pessoa passou dentro do Questor (`tempouso`) e em quais
 * empresas. É o único lugar do banco que mede esforço em horas em vez de
 * contar linhas produzidas.
 *
 * O `tempouso` é do Questor inteiro, não do módulo contábil: por isso o ranking
 * mostra só quem lançou alguma coisa no contábil no período, e o tempo de quem
 * ficou de fora vira nota, nunca some calado. A tabela não tem filial.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<ContabilTempoResp>(
    "contabil-produtividade-tempo",
    qs == null ? null : `/api/contabil/produtividade-tempo?${qs}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [pessoaSel, setPessoaSel] = useEstadoTela<number | null>("pessoa", null);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const empresas = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (pessoa) return pessoa.topEmpresas.map((e) => ({ chave: e.chave, nome: e.nome, qtd: e.qtd }));
    return d.empresas.map((e) => ({
      chave: e.chave,
      nome: e.nome,
      qtd: e.horas,
      detalhe:
        e.minutosPorLancamento == null
          ? `${num(e.pessoas)} ${e.pessoas === 1 ? "pessoa" : "pessoas"} · sem lançamento`
          : `${num(e.pessoas)} ${e.pessoas === 1 ? "pessoa" : "pessoas"} · ${decimal(e.minutosPorLancamento)} min por lançamento`,
    }));
  }, [d, pessoa]);

  const porDiaSemana = useMemo<ItemQuebra[] | undefined>(
    () => d?.porDiaSemana.map((h, i) => ({ chave: String(i), nome: DIAS_SEMANA[i], qtd: h })),
    [d]
  );

  const dispersao = useMemo(
    () => (d?.ranking ?? []).map((p) => ({ codigo: p.codigo, nome: p.nome, horas: p.horas, lancamentos: p.lancamentos })),
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
        rotulo: "Tempo por pessoa",
        nome: `tempo-contabil-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Horas", "Dias", "Horas por dia", "Empresas", "Lançamentos",
            "Lançamentos por hora",
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
        nome: `tempo-contabil-empresas-${periodo}${alvo}`,
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Código", "Empresa", "Horas"],
                linhas: pessoa.topEmpresas.map((e) => [e.chave, e.nome, decimalBR(e.qtd)]),
              }
            : {
                cabecalhos: ["Código", "Empresa", "Horas", "Pessoas", "Lançamentos", "Minutos por lançamento"],
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
        nome: `tempo-contabil-evolucao-${periodo}`,
        montar: () => ({
          cabecalhos: [g === "mes" ? "Mês" : "Dia", "Horas"],
          linhas: d.serie.map((p) => [rotuloBucketLongo(p.bucket, g), decimalBR(p.horas)]),
        }),
      },
    ];
  }, [d, pessoa]);

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.horas, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        formatarQtd={horas}
        desabilitado={carregando}
      />
      <MenuExportar modulo="contabil" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.horas === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="relogio"
            titulo="Ninguém do contábil tem tempo registrado no período"
            descricao="Amplie o período ou tire o filtro de empresa no topo."
          />
        </div>
      </>
    );

  const total = pessoa ? pessoa.horas : (d?.totais.horas ?? 0);
  const fora = d?.foraDoContabil;
  const maisCara = d?.empresas[0];
  const topEmpresa = pessoa ? pessoa.topEmpresas[0]?.nome : maisCara?.nome;
  const g = d?.periodo.granularidade ?? "dia";

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Horas no Questor"
          icone="relogio"
          carregando={carregando}
          valor={horas(total)}
          detalhe={`${num(pessoa ? pessoa.dias : (d?.totais.dias ?? 0))} dias com registro`}
        />
        <Indicador
          rotulo="Horas por dia"
          icone="calendario"
          carregando={carregando}
          valor={horas(pessoa ? pessoa.horasPorDia : (d?.totais.horasPorPessoaDia ?? 0))}
          detalhe={pessoa ? "Média nos dias em que trabalhou" : "Média por pessoa, por dia trabalhado"}
        />
        <Indicador
          rotulo="Horas por empresa"
          icone="cronometro"
          carregando={carregando}
          valor={horas(
            pessoa ? (pessoa.empresas > 0 ? pessoa.horas / pessoa.empresas : 0) : (d?.totais.horasPorEmpresa ?? 0)
          )}
          detalhe={
            pessoa
              ? "Média entre as empresas que tocou"
              : maisCara
                ? `Mais cara: ${maisCara.nome} (${horas(maisCara.horas)})`
                : "Nenhuma empresa no período"
          }
        />
        <Indicador
          rotulo="Pessoas"
          icone="pessoas"
          carregando={carregando}
          valor={num(pessoa ? 1 : (d?.totais.pessoas ?? 0))}
          detalhe={
            fora && fora.pessoas > 0
              ? `Mais ${num(fora.pessoas)} de outras áreas (${horas(fora.horas)}) fora da conta`
              : "Todas lançaram no contábil no período"
          }
        />
        <Indicador
          rotulo="Empresas tocadas"
          icone="empresa"
          carregando={carregando}
          valor={num(pessoa ? pessoa.empresas : (d?.totais.empresas ?? 0))}
          detalhe={topEmpresa ?? "Sem registro"}
        />
      </FaixaIndicadores>

      <div className="flex flex-col gap-1">
        <Nota>Tempo medido no Questor inteiro, não só no módulo contábil. A filial não recorta aqui.</Nota>
        {pessoa && <Nota>Dia da semana, série e dispersão seguem com o time todo.</Nota>}
      </div>

      <RankingPessoas
        titulo="Tempo por pessoa"
        descricao={pessoa ? "O ranking segue com o time todo" : "Só quem lançou no contábil no período"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="horas"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém do contábil tem tempo registrado no período."
        rodape={
          fora && fora.pessoas > 0 ? (
            <Nota>
              Fora desta lista: {num(fora.pessoas)} {fora.pessoas === 1 ? "pessoa" : "pessoas"} com {horas(fora.horas)} no
              Questor sem lançamento no contábil no período (folha, fiscal e afins).
            </Nota>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PainelQuebra
          titulo="Empresas que mais consomem tempo"
          descricao={pessoa ? `Onde ${pessoa.nome} passou o tempo` : "Horas do time contábil por empresa"}
          itens={empresas}
          formatar={horas}
          carregando={carregando}
        />
        <PainelQuebra
          titulo="Por dia da semana"
          descricao="Quando o time está dentro do sistema"
          itens={porDiaSemana}
          formatar={horas}
          corPadrao="var(--serie-5)"
          limite={7}
          carregando={carregando}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CaixaGrafico
          titulo="Horas no período"
          descricao={`Tempo dentro do Questor por ${nomeGranularidade(g)} · Time todo`}
          carregando={carregando}
          vazio={d && d.serie.every((p) => p.horas === 0) ? "Nenhuma hora registrada no período." : false}
        >
          <GraficoPeriodo
            pontos={d?.serie ?? []}
            granularidade={g}
            series={[{ chave: "horas", rotulo: "Horas", cor: COR_TEMPO, tipo: "area" }]}
            formatar={(v) => horas(v)}
            formatarEixo={(v) => `${numCompact(v)} h`}
          />
        </CaixaGrafico>
        {/* Horas contra o que saiu delas não é placar: quem passa o mês em
            conferência e conciliação aparece embaixo à direita com todo o
            direito. O que o gráfico serve é a dispersão: duas pessoas com a
            mesma carga em pontos opostos do eixo vertical são uma pergunta. */}
        <CaixaGrafico
          titulo="Horas × lançamentos"
          descricao="Uma bolinha por pessoa. Clique para isolar"
          carregando={carregando}
          vazio={dispersao.length === 0 ? "Sem tempo registrado no período." : false}
        >
          <GraficoDispersao
            dados={dispersao}
            x="horas"
            y="lancamentos"
            rotuloX="Horas no Questor"
            rotuloY="Lançamentos"
            nome={(p) => p.nome}
            formatarX={horas}
            cor={(p) => (p.codigo === pessoa?.codigo ? COR_ISOLADA : COR_TEMPO)}
            aoClicar={(p) => setPessoaSel(p.codigo === pessoa?.codigo ? null : p.codigo)}
          />
        </CaixaGrafico>
      </div>
    </>
  );
}
