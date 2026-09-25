"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { FiltroEspecies, useEspecies } from "@/componentes/produto/fiscal/filtros";
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
import type { FisTempoPessoa, FiscalTempoResp } from "@/lib/fiscal-tempo-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const COR_TEMPO = "var(--serie-1)";
const COR_ISOLADA = "var(--serie-2)";

const COLUNAS: ColunaRanking<FisTempoPessoa>[] = [
  { id: "horas", rotulo: "Horas", valor: (p) => p.horas, celula: (p) => horas(p.horas) },
  { id: "dias", rotulo: "Dias", dica: "Dias com algum tempo registrado", valor: (p) => p.dias },
  { id: "horasPorDia", rotulo: "Horas por dia", valor: (p) => p.horasPorDia, celula: (p) => horas(p.horasPorDia), secundaria: true },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { id: "notas", rotulo: "Notas", valor: (p) => p.notas },
  // "A dedo" é `origemdado` fora da integração (3): digitada ou importada por
  // alguém. É a parte do volume que de fato consome hora humana.
  { id: "aDedo", rotulo: "A dedo", dica: "Notas digitadas ou importadas, fora da integração", valor: (p) => p.aDedo },
  {
    id: "porHora",
    rotulo: "Notas por hora",
    // Ritmo BRUTO: cerca de 98% das notas entram pela integração sem consumir
    // hora humana, então o número absoluto infla. Serve para comparar pessoas.
    dica: "Compara pessoas entre si. Quase todas as notas entram pela integração, sem hora humana.",
    valor: (p) => p.porHora,
    celula: (p) => decimal(p.porHora),
  },
];

/**
 * Tempo do Fiscal: quanto cada pessoa passou dentro do Questor (`tempouso`) e
 * em quais empresas, contra as notas que escriturou no mesmo período.
 *
 * O `tempouso` é do Questor inteiro, não do módulo fiscal: por isso o ranking
 * mostra só quem escriturou nota no período, e o tempo de quem ficou de fora
 * vira nota, nunca some calado. A tabela não tem filial.
 *
 * O que muda em relação ao Contábil é o "a dedo": a integração grava quase
 * todo o volume sem hora humana, então o ritmo que se lê é o das notas
 * digitadas ou importadas, e o bruto fica de contraste.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const { especies, comEspecies } = useEspecies();
  const consulta = useConsulta<FiscalTempoResp>(
    "fiscal-produtividade-tempo",
    qs == null ? null : `/api/fiscal/produtividade-tempo?${comEspecies(qs)}`
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
        e.minutosPorNota == null
          ? `${num(e.pessoas)} ${e.pessoas === 1 ? "pessoa" : "pessoas"} · sem nota`
          : `${num(e.pessoas)} ${e.pessoas === 1 ? "pessoa" : "pessoas"} · ${decimal(e.minutosPorNota)} min por nota`,
    }));
  }, [d, pessoa]);

  const porDiaSemana = useMemo<ItemQuebra[] | undefined>(
    () => d?.porDiaSemana.map((h, i) => ({ chave: String(i), nome: DIAS_SEMANA[i], qtd: h })),
    [d]
  );

  // A dispersão usa o A DEDO, não o total: com quase todo o volume vindo da
  // integração, "horas × notas" desenharia o tamanho da carteira de cada um,
  // não o trabalho de cada um.
  const dispersao = useMemo(
    () => (d?.ranking ?? []).map((p) => ({ codigo: p.codigo, nome: p.nome, horas: p.horas, aDedo: p.aDedo })),
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
        rotulo: "Tempo por Pessoa",
        nome: `tempo-fiscal-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Horas", "Dias", "Horas por dia", "Empresas", "Notas", "Notas a dedo",
            "Notas por hora",
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            decimalBR(p.horas),
            p.dias,
            decimalBR(p.horasPorDia),
            p.empresas,
            p.notas,
            p.aDedo,
            decimalBR(p.porHora),
          ]),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Tempo por empresa",
        nome: `tempo-fiscal-empresas-${periodo}${alvo}`,
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Código", "Empresa", "Horas"],
                linhas: pessoa.topEmpresas.map((e) => [e.chave, e.nome, decimalBR(e.qtd)]),
              }
            : {
                cabecalhos: ["Código", "Empresa", "Horas", "Pessoas", "Notas", "Minutos por nota"],
                linhas: d.empresas.map((e) => [
                  e.chave,
                  e.nome,
                  decimalBR(e.horas),
                  e.pessoas,
                  e.notas,
                  e.minutosPorNota == null ? "" : decimalBR(e.minutosPorNota),
                ]),
              },
      },
      {
        id: "serie",
        rotulo: "Horas no Período",
        nome: `tempo-fiscal-evolucao-${periodo}`,
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
      <FiltroEspecies />
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.horas, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        formatarQtd={horas}
        desabilitado={carregando}
      />
      <MenuExportar modulo="fiscal" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.horas === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="relogio"
            titulo="Ninguém do fiscal tem tempo registrado no período"
            descricao={
              especies.length
                ? "Marque outras espécies, amplie o período ou tire o filtro de empresa no topo."
                : "Amplie o período ou tire o filtro de empresa no topo."
            }
          />
        </div>
      </>
    );

  const total = pessoa ? pessoa.horas : (d?.totais.horas ?? 0);
  const fora = d?.foraDoFiscal;
  const maisCara = d?.empresas[0];
  const topEmpresa = pessoa ? pessoa.topEmpresas[0]?.nome : maisCara?.nome;
  const aDedoPorHora = pessoa ? (pessoa.horas > 0 ? pessoa.aDedo / pessoa.horas : 0) : (d?.totais.aDedoPorHora ?? 0);
  const brutoPorHora = pessoa ? pessoa.porHora : (d?.totais.notasPorHora ?? 0);
  const g = d?.periodo.granularidade ?? "dia";

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={6}>
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
          rotulo="Notas a dedo por hora"
          icone="velocimetro"
          carregando={carregando}
          valor={decimal(aDedoPorHora)}
          detalhe={`Com a integração, ${decimal(brutoPorHora)}`}
        />
        <Indicador
          rotulo="Pessoas"
          icone="pessoas"
          carregando={carregando}
          valor={num(pessoa ? 1 : (d?.totais.pessoas ?? 0))}
          detalhe={
            fora && fora.pessoas > 0
              ? `Mais ${num(fora.pessoas)} de outras áreas (${horas(fora.horas)}) fora da conta`
              : "Todas escrituraram nota no período"
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
        <Nota>Tempo medido no Questor inteiro, não só no módulo fiscal. A filial não recorta aqui.</Nota>
        {/* O `tempouso` não conhece espécie: o filtro só decide quem entra no
            time (quem escriturou nota daquela espécie) e o que se conta de
            nota. As horas de cada um seguem as mesmas. */}
        {especies.length > 0 && (
          <Nota>A espécie recorta as notas e quem entra no ranking. As horas de cada pessoa não mudam.</Nota>
        )}
        {pessoa && <Nota>Dia da semana, série e dispersão seguem com o time todo.</Nota>}
      </div>

      <RankingPessoas
        titulo="Tempo por Pessoa"
        descricao={pessoa ? "O ranking segue com o time todo" : "Só quem escriturou nota no período"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="horas"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém do fiscal tem tempo registrado no período."
        rodape={
          fora && fora.pessoas > 0 ? (
            <Nota>
              Fora desta lista: {num(fora.pessoas)} {fora.pessoas === 1 ? "pessoa" : "pessoas"} com {horas(fora.horas)} no
              Questor sem nota escriturada no período (folha, contábil e afins).
            </Nota>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PainelQuebra
          titulo="Empresas que Mais Consomem Tempo"
          descricao={pessoa ? `Onde ${pessoa.nome} passou o tempo` : "Horas do time fiscal por empresa"}
          itens={empresas}
          formatar={horas}
          carregando={carregando}
        />
        <PainelQuebra
          titulo="Por Dia da Semana"
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
          titulo="Horas no Período"
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
            conferência e apuração aparece embaixo à direita com todo o
            direito. O que o gráfico serve é a dispersão: duas pessoas com a
            mesma carga em pontos opostos do eixo vertical são uma pergunta. */}
        <CaixaGrafico
          titulo="Horas × Notas a Dedo"
          descricao="Uma bolinha por pessoa. Clique para isolar"
          carregando={carregando}
          vazio={dispersao.length === 0 ? "Sem tempo registrado no período." : false}
        >
          <GraficoDispersao
            dados={dispersao}
            x="horas"
            y="aDedo"
            rotuloX="Horas no Questor"
            rotuloY="Notas a dedo"
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
