"use client";

import {
  CaixaGrafico,
  CalendarioAtividade,
  EscadaFaixas,
  GraficoBarrasCor,
  GraficoDispersao,
  GraficoPareto,
  GraficoSerie,
  Legenda,
  RankingBarras,
} from "@/componentes/produto/graficos";
import { Painel } from "@/componentes/primitivos/painel";
import { horas, num } from "@/lib/format";
import { Bloco, Familia } from "../bloco";
import { diasFalsos, PESSOAS_FALSAS, SERIE_FALSA } from "../dados-falsos";

const ORIGENS = [
  { chave: "manual", rotulo: "Manual", cor: "var(--serie-1)" },
  { chave: "importado", rotulo: "Importado", cor: "var(--serie-3)" },
  { chave: "integracao", rotulo: "Integração", cor: "var(--serie-5)" },
];

const FAIXAS = [
  { id: "dia", rotulo: "No mês", cor: "var(--ok)" },
  { id: "1m", rotulo: "Até 1 mês", cor: "color-mix(in oklab, var(--ok) 45%, var(--atencao))" },
  { id: "3m", rotulo: "1 a 3 meses", cor: "var(--atencao)" },
  { id: "6m", rotulo: "3 a 6 meses", cor: "color-mix(in oklab, var(--atencao) 40%, var(--perigo))" },
  { id: "mais", rotulo: "Mais de 6", cor: "var(--perigo)" },
];

const COMPET = ["mar", "abr", "mai", "jun", "jul", "ago"].map((m, i) => ({
  mes: `${m}/26`,
  qtd: [310, 420, 690, 1250, 2980, 4410][i],
  atraso: [160, 120, 85, 50, 22, 6][i],
}));

function corAtraso(dias: number) {
  return dias < 30 ? FAIXAS[0].cor : dias < 60 ? FAIXAS[1].cor : dias < 90 ? FAIXAS[2].cor : dias < 150 ? FAIXAS[3].cor : FAIXAS[4].cor;
}

export function BlocosGraficos() {
  return (
    <Familia
      id="graficos"
      titulo="Gráficos"
      descricao="A cor da série vem do catálogo do dado, não da posição. Eixo terso, porque a unidade está no título; a dica é identificada."
    >
      <Bloco
        titulo="Série no tempo"
        porque="Barras empilhadas quando a pergunta é composição (de onde veio o lançamento), linha quando é tendência. A legenda lê o mesmo catálogo que o gráfico, e o primeiro item cinza não desalinha nada."
      >
        <CaixaGrafico
          titulo="Lançamentos por origem"
          descricao="Últimos 12 meses, quantidade"
          legenda={<Legenda itens={ORIGENS} />}
        >
          <GraficoSerie dados={SERIE_FALSA} x="mes" series={ORIGENS.map((o) => ({ ...o, tipo: "barra" as const, pilha: "o" }))} />
        </CaixaGrafico>
      </Bloco>

      <Bloco
        titulo="Barras com cor por categoria"
        porque="Em que mês do fato o trabalho caiu: a barra é o volume, a cor é o atraso daquela competência. Eixo cronológico sempre; ordenar por volume responderia outra pergunta."
      >
        <CaixaGrafico titulo="Competências trabalhadas no período" descricao="Lançamentos, coloridos pelo atraso mediano" altura={200}>
          <GraficoBarrasCor
            dados={COMPET}
            x="mes"
            y="qtd"
            rotulo="Lançamentos"
            cor={(l) => corAtraso(l.atraso)}
            extrasDica={(l) => [{ rotulo: "Atraso mediano", valor: `${l.atraso} d` }]}
          />
        </CaixaGrafico>
      </Bloco>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Escada de faixas"
          porque="A pergunta é de proporção (quanto foi trabalho atrasado), então a escada vira uma barra só, do verde ao crítico. Degrau com zero continua na legenda: zero é afirmação."
        >
          <Painel titulo="Atraso da escrituração" descricao="Lançamentos do período por faixa">
            <EscadaFaixas faixas={FAIXAS} valores={[4410, 2980, 1250, 690, 0]} rotuloItem="Lançamentos" />
          </Painel>
        </Bloco>
        <Bloco
          titulo="Ranking em barras"
          porque="Em HTML, e não em SVG: mais denso, nítido em qualquer escala, e o nome longo corta com reticência em vez de enrolar sobre a barra."
        >
          <Painel titulo="Lançamentos por pessoa" corpo="p-2">
            <RankingBarras itens={PESSOAS_FALSAS} rotulo={(p) => p.nome} valor={(p) => p.lancamentos} detalhe={(p) => horas(p.horas)} />
          </Painel>
        </Bloco>
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Dispersão"
          porque="Horas no Questor contra lançamentos, uma bolinha por pessoa. Separa quem produz muito em pouco tempo de quem passa o dia aberto sem lançar."
        >
          <CaixaGrafico titulo="Horas × Lançamentos" altura={220}>
            <GraficoDispersao dados={PESSOAS_FALSAS} x="horas" y="lancamentos" rotuloX="Horas" rotuloY="Lançamentos" nome={(p) => p.nome} formatarX={horas} />
          </CaixaGrafico>
        </Bloco>
        <Bloco
          titulo="Pareto"
          porque="Barras em ordem de volume e a linha do acumulado: diz quantas empresas respondem pela maior parte do trabalho."
        >
          <CaixaGrafico titulo="Concentração por pessoa" altura={220}>
            <GraficoPareto dados={PESSOAS_FALSAS.map((p) => ({ ...p, curto: p.nome.split(" ")[0] }))} x="curto" y="lancamentos" rotulo="Lançamentos" />
          </CaixaGrafico>
        </Bloco>
      </div>

      <Bloco
        titulo="Calendário de atividade"
        porque="Um quadrado por dia mostra o padrão: fim de semana parado, pico no fechamento. A régua é o p95, senão um dia de fechamento apaga o resto; para nomear um dia, a dica diz a data e o número."
      >
        <Painel titulo="Atividade diária" descricao="Jun a ago/2026">
          <CalendarioAtividade dias={diasFalsos()} formatar={num} />
        </Painel>
      </Bloco>
    </Familia>
  );
}
