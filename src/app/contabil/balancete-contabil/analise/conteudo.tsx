"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Esqueleto, Girando, Nota, PainelErro } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { CabecalhoPapel } from "@/componentes/produto/cabecalho-papel";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";
import { nomeMes } from "@/lib/contexto";
import { decimalBR } from "@/lib/csv";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import type { AnaliseBalanceteResp } from "@/lib/types";
import { LaudoEscrito } from "./laudo-escrito";
import {
  COR_GRUPO,
  FAIXA,
  FaixaLeitura,
  FLUXO_EVOLUCAO,
  nomeSemSinal,
  PainelDre,
  PainelEstrutura,
  PainelIndicadores,
  PainelSerieMensal,
  PainelValidacao,
  SEVERIDADE,
  TENDENCIA,
  type LinhaMensal,
} from "./secoes";

/** Fração (0,125) no CSV como percentual com vírgula (12,50). */
const pctCsv = (v: number | null) => (v == null ? "" : decimalBR(v * 100));

function Carregando() {
  return (
    <>
      <FaixaIndicadores>
        {["Saúde geral", "Fechamento", "Resultado do período", "Ativo total", "Alertas"].map((r) => (
          <Indicador key={r} rotulo={r} valor="" detalhe="" carregando />
        ))}
      </FaixaIndicadores>
      <Painel titulo="Validação Contábil" icone="escudo">
        <div aria-busy className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-pequeno text-apagado">
            <Girando />
            Coletando os saldos e aplicando as regras
          </p>
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="h-10 w-3/4" />
        </div>
      </Painel>
    </>
  );
}

export default function Conteudo() {
  const { qs } = useExecucao();
  // O motor é determinístico sobre um recorte fechado: o mesmo recorte dá a
  // mesma análise, então o resultado não envelhece enquanto a tela vive.
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useConsulta<AnaliseBalanceteResp>(
    "analise-balancete",
    qs ? `/api/contabil/analise-balancete?${qs}` : null,
    { staleTime: Infinity }
  );

  if (isError) {
    return (
      <PainelErro titulo="Não deu para analisar o balancete" mensagem={(error as Error).message} onTentar={() => refetch()} />
    );
  }
  if (isLoading || !data) return <Carregando />;

  const { analise, empresa, periodo } = data;
  const meses = periodo.meses;
  const rotuloPeriodo =
    meses.length > 1
      ? `${nomeMes(meses[0], true)} a ${nomeMes(meses[meses.length - 1], true)}`
      : meses.length === 1
        ? nomeMes(meses[0], true)
        : `${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`;
  const sufixo = `${empresa.codigo}-${periodo.inicio.slice(0, 7)}-a-${periodo.fim.slice(0, 7)}`;

  const patrimonio = analise.estrutura.map<LinhaMensal>((g) => ({
    chave: g.chave,
    nome: g.nome,
    serie: g.serie,
    cor: COR_GRUPO[g.chave],
    tipo: "linha",
  }));
  const fluxo = analise.dre
    .filter((l) => l.chave in FLUXO_EVOLUCAO)
    .map<LinhaMensal>((l) => ({
      chave: l.chave,
      nome: nomeSemSinal(l.nome),
      serie: l.serie,
      cor: FLUXO_EVOLUCAO[l.chave],
      destaque: l.chave === "resultado",
      negativoNormal: l.chave === "custoDespesa",
      tipo: l.chave === "resultado" ? "linha" : "barra",
    }));

  const cortes: CorteExportar[] = [
    {
      id: "indicadores",
      rotulo: "Indicadores",
      nome: `analise-indicadores-${sufixo}`,
      montar: () => ({
        cabecalhos: ["Indicador", "Último mês", "Leitura", "Tendência", "O que diz"],
        linhas: analise.indicadores.map((i) => [
          i.nome,
          i.formatado,
          FAIXA[i.faixa].rotulo,
          TENDENCIA[i.tendencia]?.rotulo ?? "",
          i.interpretacao,
        ]),
      }),
    },
    {
      id: "alertas",
      rotulo: "Alertas da validação",
      nome: `analise-alertas-${sufixo}`,
      montar: () => ({
        cabecalhos: ["Severidade", "Achado", "Detalhe", "Conta", "Valor"],
        linhas: analise.inconsistencias.map((i) => [
          SEVERIDADE[i.severidade].rotulo,
          i.titulo,
          i.detalhe,
          i.conta ?? "",
          i.valor != null ? decimalBR(i.valor) : "",
        ]),
      }),
    },
    {
      id: "estrutura",
      rotulo: "Estrutura Patrimonial",
      nome: `analise-estrutura-${sufixo}`,
      montar: () => ({
        cabecalhos: ["Grupo", "Saldo", "Parte (%)"],
        linhas: [
          ...analise.estrutura.map((g) => [g.nome, decimalBR(g.saldo), pctCsv(g.pctBase)]),
          ["Ativo total", decimalBR(analise.totais.ativo), "100"],
          ["Passivo e PL", decimalBR(analise.totais.passivo + analise.totais.pl), "100"],
        ],
      }),
    },
    {
      id: "dre",
      rotulo: "Resultado do Período",
      nome: `analise-dre-${sufixo}`,
      montar: () => ({
        cabecalhos: ["Linha", "Valor", "Da receita (%)"],
        linhas: analise.dre.map((l) => [l.nome, decimalBR(l.valor), pctCsv(l.pctReceita)]),
      }),
    },
    ...(meses.length > 1
      ? [
          {
            id: "evolucao",
            rotulo: "Evolução mês a mês",
            nome: `analise-evolucao-${sufixo}`,
            montar: () => ({
              cabecalhos: ["Linha", "Leitura", ...meses.map((m) => nomeMes(m))],
              linhas: [
                ...patrimonio.map((l) => [l.nome, "Saldo ao fim do mês", ...l.serie.map((v) => decimalBR(v))]),
                ...fluxo.map((l) => [l.nome, "Movimento do mês", ...l.serie.map((v) => decimalBR(v))]),
              ],
            }),
          },
        ]
      : []),
  ];

  return (
    <>
      <AcoesPagina>
        {/* O botão não vai para o papel; `contents` não mexe na fila da tela. */}
        <span className="nx-sem-papel contents">
          <MenuExportar modulo="contabil" cortes={cortes} imprimir="análise de balancete" />
        </span>
      </AcoesPagina>

      <CabecalhoPapel
        titulo="Análise de Balancete"
        empresa={empresa}
        itens={[
          { rotulo: "Período", valor: `${rotuloPeriodo} (${num(meses.length)} ${meses.length === 1 ? "mês" : "meses"})` },
          { rotulo: "Filiais", valor: "Todas, consolidado" },
          { rotulo: "Dados de", valor: dataHoraBR(new Date(dataUpdatedAt).toISOString()) },
        ]}
      />

      <FaixaLeitura analise={analise} />
      <PainelValidacao analise={analise} />
      <PainelIndicadores analise={analise} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelEstrutura analise={analise} />
        <PainelDre dre={analise.dre} />
      </div>
      {meses.length > 1 && (
        <>
          <PainelSerieMensal
            titulo="Patrimônio Mês a Mês"
            descricao="Saldo de cada grupo ao fim do mês"
            meses={meses}
            linhas={patrimonio}
          />
          <PainelSerieMensal
            titulo="Resultado Mês a Mês"
            descricao="Receita, custos e resultado no movimento de cada mês"
            meses={meses}
            linhas={fluxo}
          />
        </>
      )}
      {qs && <LaudoEscrito qs={qs} />}
      <Nota icone="escudo">Regras, indicadores e alertas calculados dos saldos do contábil, sem IA.</Nota>
    </>
  );
}
