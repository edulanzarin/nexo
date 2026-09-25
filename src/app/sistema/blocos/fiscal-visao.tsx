"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { ComposicaoEspecies } from "@/componentes/produto/fiscal/composicao-especies";
import { ComposicaoImpostos } from "@/componentes/produto/fiscal/composicao-impostos";
import { AlternadorMetrica, FiltroEspecies } from "@/componentes/produto/fiscal/filtros";
import { COR_LADO, ROTULO_LADO, SeletorLado, type Lado } from "@/componentes/produto/fiscal/lado";
import { CorpoItemRanking, PainelRanking } from "@/componentes/produto/fiscal/painel-ranking";
import type { EspecieResumo, Impostos, Metrica, TopItem } from "@/lib/types";
import { Bloco, Variante } from "../bloco";

/*
 * Peças do Fiscal que nasceram nas telas de Visão e Rotina (Painel, Análises,
 * Tributos, Conformidade): os filtros do módulo, o lado da nota, o ranking, a
 * composição dos impostos e a composição por espécie. Tudo com dado de mentira.
 */

const METRICAS: { valor: Metrica; rotulo: string }[] = [
  { valor: "valor", rotulo: "Valor" },
  { valor: "qtd", rotulo: "Quantidade" },
];

const CLIENTES: TopItem[] = [
  { codigo: 1, nome: "ATACADAO DISTRIBUICAO COM E IND", valor: 4812300.42, qtd: 1204, detalhe: "SC" },
  { codigo: 2, nome: "SUPERMERCADOS BOM PRECO LTDA", valor: 3120980.1, qtd: 2980, detalhe: "SC" },
  { codigo: 3, nome: "COOPERATIVA AGROINDUSTRIAL ALFA", valor: 2204112.9, qtd: 312, detalhe: "PR" },
  { codigo: 4, nome: "MERCADO LIVRE LTDA", valor: 1480220, qtd: 4102, detalhe: "SP" },
  { codigo: 5, nome: "WEG EQUIPAMENTOS ELETRICOS S/A", valor: 998410.55, qtd: 88, detalhe: "SC" },
  { codigo: 6, nome: "EMBALAGENS PLASTICAS VALE LTDA", valor: 612300, qtd: 205, detalhe: "SC" },
  { codigo: 7, nome: "POSTO DE COMBUSTIVEIS BR 280", valor: 402118.3, qtd: 1511, detalhe: "SC" },
  { codigo: 8, nome: "TRANSPORTADORA TRES IRMAOS", valor: 210400, qtd: 64, detalhe: "RS" },
];

const FORNECEDORES: TopItem[] = [
  { codigo: 11, nome: "DISTRIBUIDORA SUL BRASIL LTDA", valor: 2980400, qtd: 842, detalhe: "SC" },
  { codigo: 12, nome: "ENERGISA SANTA CATARINA", valor: 1204800.2, qtd: 96, detalhe: "SC" },
  { codigo: 13, nome: "TOTVS S/A", valor: 410220, qtd: 12, detalhe: "SP" },
  { codigo: 14, nome: "ATACADAO DISTRIBUICAO COM E IND", valor: 388100, qtd: 301, detalhe: "SC" },
];

const FAIXAS: TopItem[] = [
  { codigo: 0, nome: "Até R$ 100", valor: 184220, qtd: 4120, detalhe: null },
  { codigo: 1, nome: "R$ 100 – 500", valor: 812400, qtd: 3310, detalhe: null },
  { codigo: 2, nome: "R$ 500 – 1 mil", valor: 1020300, qtd: 1402, detalhe: null },
  { codigo: 3, nome: "R$ 1 mil – 5 mil", valor: 3890100, qtd: 1880, detalhe: null },
  { codigo: 4, nome: "R$ 5 mil – 20 mil", valor: 5012000, qtd: 512, detalhe: null },
  { codigo: 5, nome: "Acima de R$ 20 mil", valor: 8120400, qtd: 96, detalhe: null },
];

const IMPOSTOS_SAI: Impostos = {
  icms: 1284300.12,
  st: 312400,
  ipi: 188920.4,
  iss: 42100,
  pis: 96210.8,
  cofins: 443180.2,
  irrf: 12400,
  inss: 8900.5,
  csll: 4120,
  issqn: 0,
  difal: 38400,
  fcp: 7680,
  funrural: 2210,
  totalItens: 14820300,
};

const IMPOSTOS_ENT: Impostos = {
  ...IMPOSTOS_SAI,
  icms: 802100,
  st: 104300,
  ipi: 92010,
  iss: 0,
  pis: 51200,
  cofins: 236100,
  irrf: 0,
  inss: 0,
  csll: 0,
  difal: 0,
  fcp: 0,
  funrural: 0,
  totalItens: 9120400,
};

const ESPECIES: EspecieResumo[] = [
  { especie: "NFE", entradas: 8120400, saidas: 12410300, qtd: 9120 },
  { especie: "NFCE", entradas: 0, saidas: 2204100, qtd: 48210 },
  { especie: "NFSE", entradas: 612300, saidas: 1480200, qtd: 1320 },
  { especie: "CTE", entradas: 402100, saidas: 88100, qtd: 2104 },
  { especie: "CF", entradas: 0, saidas: 312400, qtd: 6120 },
  { especie: "Outras", entradas: 120400, saidas: 40100, qtd: 402 },
];

/** A rota ordena pela métrica; aqui o dado de mentira faz o mesmo. */
const ordenar = (lista: TopItem[], metrica: Metrica) =>
  [...lista].sort((a, b) => (metrica === "valor" ? b.valor - a.valor : b.qtd - a.qtd));

export function BlocosFiscalVisao() {
  const [lado, setLado] = useState<Lado>("sai");
  const [metrica, setMetrica] = useState<Metrica>("valor");
  const [ladoImpostos, setLadoImpostos] = useState<Lado>("sai");
  const [metricaEsp, setMetricaEsp] = useState<Metrica>("valor");

  return (
    <>
      <Bloco
        titulo="Filtros do Fiscal"
        porque="Espécie da nota e valor ou quantidade só existem no Fiscal, então não sobem para o contexto do topo; vão no cabeçalho da tela e valem pelo módulo inteiro, e quem filtra NFS-e no Painel continua em NFS-e nas Análises. Aplicam na hora, como todo filtro de tela."
      >
        <div className="flex flex-wrap items-center gap-6">
          <Variante nome="Espécie da nota">
            <FiltroEspecies />
          </Variante>
          <Variante nome="Espécie travada (tela cujas tabelas não têm espécie)">
            <FiltroEspecies desabilitado />
          </Variante>
          <Variante nome="Métrica">
            <AlternadorMetrica />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Lado da nota"
        porque="Entrada é azul e saída é verde no módulo inteiro: a barra de um ranking e a área da série falam do mesmo lado sem legenda para decorar. O seletor mora no cabeçalho do painel que mede um lado só, e cada painel guarda o seu."
      >
        <div className="flex flex-wrap items-center gap-6">
          <SeletorLado lado={lado} onMudar={setLado} />
          {(["ent", "sai"] as Lado[]).map((l) => (
            <span key={l} className="flex items-center gap-1.5 text-pequeno text-tinta-2">
              <span aria-hidden className="size-2 rounded-[3px]" style={{ background: COR_LADO[l] }} />
              {ROTULO_LADO[l]}
            </span>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Ranking do Fiscal"
        porque="A barra mede a métrica do módulo e a outra vai em miúdo ao lado dela, então trocar valor por quantidade reordena sem apagar o que a linha dizia. No erro o corpo vira o aviso e o seletor fica, porque trocar o lado é o primeiro gesto de quem quer tentar outra coisa. Clique numa linha para o detalhe."
      >
        <div className="flex flex-col gap-4">
          <Segmentado rotulo="Métrica do exemplo" opcoes={METRICAS} valor={metrica} onMudar={setMetrica} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <PainelRanking
              titulo={lado === "ent" ? "Maiores Fornecedores" : "Maiores Clientes"}
              descricao={metrica === "valor" ? `Valor contábil ${lado === "ent" ? "das entradas" : "das saídas"}` : `Notas ${lado === "ent" ? "de entrada" : "de saída"}`}
              itens={ordenar(lado === "ent" ? FORNECEDORES : CLIENTES, metrica)}
              metrica={metrica}
              lado={lado}
              onLado={setLado}
              rotuloMedio="Ticket médio"
              limite={6}
            />
            <PainelRanking
              titulo="Notas por Faixa de Valor"
              descricao={`${metrica === "valor" ? "Valor contábil" : "Notas"} em cada faixa`}
              itens={FAIXAS}
              metrica={metrica}
              lado={lado}
              onLado={setLado}
              rotuloMedio="Ticket médio"
              ordinal
              completa
            />
            <Variante nome="Carregando">
              <PainelRanking titulo="CFOPs Mais Usados" itens={undefined} metrica="valor" lado="sai" onLado={() => {}} carregando />
            </Variante>
            <Variante nome="Vazio e erro">
              <div className="flex flex-col gap-4">
                <PainelRanking titulo="Municípios da Contraparte" itens={[]} metrica="valor" lado="ent" onLado={() => {}} />
                <PainelRanking
                  titulo="Origem do Dado"
                  itens={undefined}
                  metrica="valor"
                  lado="sai"
                  onLado={() => {}}
                  erro="A consulta passou de 60 segundos no Questor."
                  onTentar={() => {}}
                />
              </div>
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Detalhe de uma linha do ranking"
        porque="A barra abrevia o valor e o nome trunca; o detalhe traz o valor cheio, a quantidade, a média e, quando a lista é o universo todo, a participação. Num top 10 a posição não diz de quantos, porque sugeriria que só existem dez."
      >
        <PainelModal
          estatico
          titulo={CLIENTES[0].nome}
          descricao={`${CLIENTES[0].detalhe} · Saídas`}
          onFechar={() => {}}
          rodape={<Botao>Fechar</Botao>}
        >
          <CorpoItemRanking item={CLIENTES[0]} posicao={1} rotuloMedio="Ticket médio" />
        </PainelModal>
      </Bloco>

      <Bloco
        titulo="Composição dos impostos"
        porque="Os seis destacados dividem a barra, cada um com o peso sobre o valor dos itens; retenções e interestadual só aparecem quando existem no período. A cor é do imposto e não muda de tela, e o COFINS não usa o azul de entrada, que aqui é o mesmo do ICMS."
      >
        <div className="flex flex-col gap-4">
          <ComposicaoImpostos
            dados={ladoImpostos === "ent" ? IMPOSTOS_ENT : IMPOSTOS_SAI}
            lado={ladoImpostos}
            onLado={setLadoImpostos}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Variante nome="Carregando">
              <ComposicaoImpostos dados={undefined} lado="sai" onLado={() => {}} carregando />
            </Variante>
            <Variante nome="Vazio">
              <ComposicaoImpostos
                dados={{ ...IMPOSTOS_ENT, icms: 0, st: 0, ipi: 0, pis: 0, cofins: 0, totalItens: 0 }}
                lado="ent"
                onLado={() => {}}
              />
            </Variante>
            <Variante nome="Erro">
              <ComposicaoImpostos
                dados={undefined}
                lado="sai"
                onLado={() => {}}
                erro="A consulta passou de 60 segundos no Questor."
                onTentar={() => {}}
              />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Composição por espécie"
        porque="Barra e lista no lugar do donut: a proporção se lê na barra e o número vai escrito, com a divisão entre entradas e saídas embaixo. A cor é a da espécie no catálogo; espécie fora dele (CF) cai em Outras, e o nome dela vai na dica de Outras."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Painel
            titulo="Por Espécie"
            descricao={metricaEsp === "valor" ? "Valor contábil de entradas e saídas" : "Notas de entrada e de saída"}
            acoes={<Segmentado rotulo="Métrica do exemplo" opcoes={METRICAS} valor={metricaEsp} onMudar={setMetricaEsp} />}
          >
            <ComposicaoEspecies dados={ESPECIES} metrica={metricaEsp} />
          </Painel>
          <Variante nome="Uma espécie só (filtro de NFS-e)">
            <Painel titulo="Por Espécie" descricao="Valor contábil de entradas e saídas">
              <ComposicaoEspecies dados={ESPECIES.filter((e) => e.especie === "NFSE")} metrica="valor" />
            </Painel>
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
