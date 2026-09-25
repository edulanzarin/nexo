"use client";

import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { ListaOpcoes } from "@/componentes/primitivos/combo";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import {
  FitaCompetencias,
  LegendaFechamento,
  SeloFechamento,
} from "@/componentes/produto/contabil/fechamento";
import { ComposicaoClasses } from "@/componentes/produto/produtividade/composicao-classes";
import { CurvaConcentracao } from "@/componentes/produto/produtividade/curva-concentracao";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { HorasDoDia } from "@/componentes/produto/produtividade/horas-do-dia";
import { CorpoQuebra, ModalQuebra } from "@/componentes/produto/produtividade/modal-quebra";
import { PainelCalendario } from "@/componentes/produto/produtividade/painel-calendario";
import { PainelEscada } from "@/componentes/produto/produtividade/painel-escada";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import { SerieClasses } from "@/componentes/produto/produtividade/serie-periodo";
import { TabelaCarteira } from "@/componentes/produto/produtividade/tabela-carteira";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { brl, brlCompact, num } from "@/lib/format";
import type { ProdCalendario, SeriePontoGen } from "@/lib/prod-tipos";
import { FAIXAS_PARADA } from "@/lib/contabil-carteira-tipos";
import { FAIXAS_IDADE } from "@/lib/contabil-exclusoes-tipos";
import type { SituacaoFechamento } from "@/lib/contabil-fechamento-tipos";
import { CLASSES } from "@/lib/contabil-produtividade-tipos";
import { Bloco, Variante } from "../bloco";
import { diasFalsos, EMPRESAS_FALSAS, PESSOAS_FALSAS } from "../dados-falsos";

/*
 * Peças da Produtividade, que o Contábil estreia e o Fiscal e o DP reusam:
 * filtro por pessoa, ranking ordenável, composição por classe, série, hora do
 * dia, calendário, quebras, escada de idade, concentração e a carteira. Mais a
 * fita de fechamento, que é só do Contábil. Tudo com dado de mentira.
 */

interface PessoaFalsa {
  codigo: number;
  nome: string;
  inativo: boolean;
  lancamentos: number;
  digitado: number;
  importado: number;
  empresas: number;
  mediana: number;
}

const PESSOAS: PessoaFalsa[] = PESSOAS_FALSAS.map((p, i) => ({
  codigo: 100 + i,
  nome: p.nome,
  inativo: i === 5,
  lancamentos: p.lancamentos,
  digitado: Math.round(p.lancamentos * (0.62 - i * 0.07)),
  importado: Math.round(p.lancamentos * (0.25 + i * 0.05)),
  empresas: 18 + ((i * 7) % 23),
  mediana: [4, 12, 38, 7, 104, 21, 3][i],
}));

const COLUNAS: ColunaRanking<PessoaFalsa>[] = [
  { id: "lancamentos", rotulo: "Lançamentos", valor: (p) => p.lancamentos },
  { id: "digitado", rotulo: "Digitado", cor: CLASSES[0].cor, dica: "Lançado a dedo na Contabilidade", valor: (p) => p.digitado },
  { id: "importado", rotulo: "Importado", cor: CLASSES[1].cor, dica: "Importação e conciliação", valor: (p) => p.importado },
  {
    id: "mediana",
    rotulo: "Atraso mediano",
    dica: "Metade dos lançamentos demorou mais que isso",
    valor: (p) => p.mediana,
    celula: (p) => `${num(p.mediana)} d`,
    alerta: (p) => p.mediana > 90,
  },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas, secundaria: true },
];

const POR_CLASSE = { digitado: 9214, importado: 6120, integrado: 4872, apuracao: 318, outros: 0 };
const TOTAL_CLASSES = Object.values(POR_CLASSE).reduce((a, b) => a + b, 0);

const SERIE: SeriePontoGen[] = Array.from({ length: 31 }, (_, i) => {
  const dia = new Date(Date.UTC(2026, 7, i + 1));
  const util = dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6;
  const fim = i >= 24 ? 2.2 : 1;
  const digitado = util ? Math.round((260 + ((i * 53) % 140)) * fim) : 0;
  const importado = util ? Math.round((150 + ((i * 97) % 220)) * fim) : 0;
  const integrado = i % 7 === 2 ? 1400 : util ? 60 : 0;
  const apuracao = i >= 27 && util ? 40 : 0;
  return {
    bucket: dia.toISOString().slice(0, 10),
    total: digitado + importado + integrado + apuracao,
    digitado,
    importado,
    integrado,
    apuracao,
    outros: 0,
  };
});

const POR_HORA = [0, 0, 0, 0, 0, 12, 40, 380, 920, 1310, 1420, 1180, 420, 860, 1350, 1290, 1140, 820, 410, 190, 80, 30, 0, 0];

const CELULAS = diasFalsos()
  .filter((d) => d.valor > 0)
  .map((d) => ({ d: d.dia, n: d.valor }));
const CALENDARIO: ProdCalendario = {
  inicio: "2026-06-01",
  fim: "2026-08-31",
  celulas: CELULAS,
  total: CELULAS.reduce((s, c) => s + c.n, 0),
  pico: CELULAS.reduce<{ d: string; n: number } | null>((m, c) => (!m || c.n > m.n ? c : m), null),
};

const cor = (id: string) => CLASSES.find((c) => c.id === id)?.cor;
const ORIGENS: ItemQuebra[] = [
  { chave: "CB", nome: "Contabilidade", qtd: 9102, cor: cor("digitado"), detalhe: `7 pessoas · ${brlCompact(4212380)}` },
  { chave: "IP", nome: "Importação de lançamentos", qtd: 4380, cor: cor("importado"), detalhe: `5 pessoas · ${brlCompact(2904100)}` },
  { chave: "FI", nome: "Fiscal", qtd: 3920, cor: cor("integrado"), detalhe: `6 pessoas · ${brlCompact(8120450)}` },
  { chave: "CC", nome: "Conciliação Bancária", qtd: 1740, cor: cor("importado"), detalhe: `4 pessoas · ${brlCompact(1098300)}` },
  { chave: "FP", nome: "Folha de pagamento", qtd: 952, cor: cor("integrado"), detalhe: `3 pessoas · ${brlCompact(640220)}` },
  { chave: "ZZ", nome: "Zeramento", qtd: 318, cor: cor("apuracao"), detalhe: `2 pessoas · ${brlCompact(212800)}` },
];

const PARETO = Array.from({ length: 21 }, (_, i) => {
  const x = i * 5;
  return { pctEmpresas: x, pctItens: Math.round(100 * (1 - Math.pow(1 - x / 100, 3.2)) * 10) / 10 };
});

const CARTEIRA = EMPRESAS_FALSAS.map((e, i) => ({
  ...e,
  ativa: i !== 6,
  lancamentos: [1840, 0, 612, 0, 2210, 94, 0, 388][i],
  valor: [412000, 0, 88000, 0, 1210000, 9400, 0, 51200][i],
  pessoas: [3, 0, 1, 0, 4, 1, 0, 2][i],
  principal: [PESSOAS_FALSAS[0].nome, null, PESSOAS_FALSAS[2].nome, null, PESSOAS_FALSAS[1].nome, PESSOAS_FALSAS[4].nome, null, PESSOAS_FALSAS[3].nome][i],
  ultimo: ["2026-08-29", "2026-05-12", "2026-08-21", null, "2026-08-30", "2026-08-04", "2025-11-03", "2026-08-18"][i],
  diasParada: [2, 111, 10, null, 1, 27, 301, 13][i],
}));
const itensCarteira = (e: (typeof CARTEIRA)[number]) => e.lancamentos;

const MESES = ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"];
const FITAS: { nome: string; situacoes: SituacaoFechamento[] }[] = [
  { nome: "Em dia", situacoes: ["fechada", "fechada", "fechada", "fechada", "fechada", "aberta"] },
  { nome: "Atrasada há três meses", situacoes: ["fechada", "fechada", "aberta", "aberta", "aberta", "aberta"] },
  { nome: "Sazonal", situacoes: ["fechada", "sem-movimento", "sem-movimento", "fechada", "fechada", "sem-movimento"] },
];

const QUEM_USOU = PESSOAS.slice(0, 5).map((p, i) => ({ codigo: p.codigo, nome: p.nome, qtd: [3120, 2410, 1880, 1102, 590][i] }));

function FatosOrigem() {
  return (
    <>
      <Par rotulo="Código">
        <span className="num">CB</span>
      </Par>
      <Par rotulo="Natureza">Digitado</Par>
      <Par rotulo="Lançamentos">
        <span className="num font-[600]">{num(9102)}</span>
      </Par>
      <Par rotulo="Valor">
        <span className="num">{brl(4212380)}</span>
      </Par>
    </>
  );
}

export function BlocosContabilProdutividade() {
  const [pessoa, setPessoa] = useState<number | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);

  return (
    <>
      <Bloco
        titulo="Filtro por pessoa"
        porque="Isola uma pessoa no resto da tela sem voltar ao banco: a lista sai do ranking que já está na memória, com o número que a aba conta ao lado do nome. Serve o Contábil, o Fiscal e o DP, com a chave numérica do Questor ou o uuid do NaveX, e quem sumiu do ranking depois de executar de novo volta para o time todo."
      >
        <div className="flex flex-wrap items-start gap-8">
          <Variante nome="No cabeçalho da aba">
            <FiltroPessoa
              pessoas={PESSOAS.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.lancamentos, inativo: p.inativo }))}
              valor={pessoa}
              onMudar={setPessoa}
            />
          </Variante>
          <Variante nome="Aberto">
            {/* inert: a lista foca a busca ao montar, e no catálogo isso rolaria a página até aqui. */}
            <div inert className="nx-flutua flex w-80 flex-col rounded-painel">
              <ListaOpcoes
                opcoes={[
                  { valor: "todos", rotulo: "Todo o time", icone: "pessoas" },
                  ...PESSOAS.slice(0, 5).map((p) => ({
                    valor: String(p.codigo),
                    rotulo: p.nome,
                    detalhe: num(p.lancamentos),
                  })),
                ]}
                marcadas={new Set(["todos"])}
                onEscolher={() => {}}
                busca
              />
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Variação contra o período anterior"
        porque="Mora dentro da linha de detalhe do indicador, não num cartão ao lado. A cor diz se andou para o lado bom, e o lado bom é de quem chama: mais lançamento é bom, mais exclusão não é. Sem período anterior, não se desenha."
      >
        <FaixaIndicadores colunas={3}>
          <Indicador
            rotulo="Lançamentos"
            icone="nota"
            valor={num(20524)}
            detalhe={
              <>
                <Variacao atual={20524} anterior={18310} /> · {brlCompact(4212380)} movimentados
              </>
            }
          />
          <Indicador
            rotulo="Exclusões"
            icone="apagar"
            valor={num(1840)}
            detalhe={
              <>
                <Variacao atual={1840} anterior={1210} bomQuandoSobe={false} /> · {brlCompact(312400)} apagados
              </>
            }
          />
          <Indicador
            rotulo="Registros no NaveX"
            icone="atividade"
            valor={num(412)}
            detalhe={
              <>
                <Variacao atual={412} anterior={530} /> · 19 dias com movimento
              </>
            }
          />
        </FaixaIndicadores>
      </Bloco>

      <Bloco
        titulo="Ranking de pessoas"
        porque="Clicar numa linha isola a pessoa no resto da tela e clicar de novo devolve o time; o ranking segue inteiro, porque ele é a comparação. A barra sob o nome mede a coluna ordenada, não a primeira: ordenar por atraso e ver a barra do volume seria um gráfico contando outra história."
      >
        <div className="flex flex-col gap-4">
          <RankingPessoas
            titulo="Quem Lançou"
            descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
            linhas={PESSOAS}
            colunas={COLUNAS}
            ordemInicial="lancamentos"
            selecionada={pessoa}
            onSelecionar={setPessoa}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Carregando">
              <RankingPessoas
                titulo="Quem Lançou"
                linhas={undefined}
                colunas={COLUNAS}
                ordemInicial="lancamentos"
                carregando
                selecionada={null}
                onSelecionar={() => {}}
              />
            </Variante>
            <Variante nome="Vazio">
              <RankingPessoas
                titulo="Quem Excluiu"
                linhas={[]}
                colunas={COLUNAS}
                ordemInicial="lancamentos"
                selecionada={null}
                onSelecionar={() => {}}
                vazio="Ninguém apagou nada no período."
              />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Composição por classe"
        porque="De que é feito o total: natureza do lançamento, espécie da nota, tipo de gesto no NaveX. Uma barra e o peso de cada classe, na cor do catálogo do dado. Classe zerada pode sumir (Outras origens num mês em que tudo se classificou); as outras ficam, porque zero em Digitado é afirmação."
      >
        <Painel titulo="Por Natureza" descricao="Lançamentos do time">
          <ComposicaoClasses classes={CLASSES} porClasse={POR_CLASSE} total={TOTAL_CLASSES} ocultarVazio={["outros"]} />
        </Painel>
      </Bloco>

      <Bloco
        titulo="Série por classe"
        porque="O ritmo do período empilhado pela classe responde se o pico foi trabalho ou integração. Com uma pessoa isolada a série vira barra única: a quebra dia × classe por pessoa não vem do servidor, e ratear pela proporção do período desenharia o que o dado não sustenta."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SerieClasses pontos={SERIE} classes={CLASSES} granularidade="dia" rotuloItem="Lançamentos" />
          <SerieClasses
            pontos={SERIE.map((p) => ({ bucket: p.bucket, total: Math.round(p.total * 0.18) }))}
            classes={CLASSES}
            granularidade="dia"
            soTotal
            rotuloItem="Lançamentos"
            descricao={`Lançamentos de ${PESSOAS[0].nome} por dia`}
          />
        </div>
      </Bloco>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Hora do dia"
          porque="Antes das 7h e a partir das 19h ganha a cor de atenção e a porcentagem no cabeçalho: é rotina rodando fora de hora ou gente virando a noite no fechamento."
        >
          <HorasDoDia porHora={POR_HORA} descricao="Lançamentos por hora do dia · Time todo" />
        </Bloco>
        <Bloco
          titulo="Calendário do período"
          porque="Do primeiro ao último dia pedido, não do primeiro com movimento: a semana parada do começo do mês também é dado. O pico vai escrito no cabeçalho, porque ninguém conta quadrados."
        >
          <PainelCalendario calendario={CALENDARIO} rotuloItem="Lançamentos" descricao="Lançamentos por dia · Time todo" />
        </Bloco>
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Quebra em barras"
          porque="Por origem, empresa, autor ou dia da semana, em barras horizontais: nome de empresa é longo. O que a barra mede é de quem chama (lançamentos, dias de atraso, horas), e passado o limite o rodapé diz quantos ficaram de fora."
        >
          <div className="flex flex-col gap-4">
            <PainelQuebra
              titulo="Por Origem"
              descricao="De onde vieram os lançamentos · Time todo"
              itens={ORIGENS}
              limite={5}
              aoClicar={(i) => setOrigem(i.chave)}
              selecionado={origem}
            />
            <Variante nome="Carregando">
              <PainelQuebra titulo="Por Empresa" itens={undefined} carregando />
            </Variante>
          </div>
        </Bloco>
        <Bloco
          titulo="Detalhe de uma quebra"
          porque="Clicar numa origem abre quem a usou, na ordem de quanto usou, tirado do ranking que já está na memória. Clicar numa pessoa ali isola ela na tela: é o passo seguinte de quem mais usou isto?"
        >
          <div className="flex flex-col gap-3">
            <PainelModal
              estatico
              titulo="Contabilidade"
              descricao="Lançado a dedo na Contabilidade (CB)"
              onFechar={() => {}}
              rodape={<Botao>Fechar</Botao>}
            >
              <CorpoQuebra fatos={<FatosOrigem />} pessoas={QUEM_USOU} rotuloPessoas="Quem usou esta origem" />
            </PainelModal>
            <div>
              <Botao icone="ver" onClick={() => setOrigem("CB")}>
                Abrir de verdade
              </Botao>
            </div>
            <ModalQuebra
              aberto={origem != null}
              onFechar={() => setOrigem(null)}
              titulo={ORIGENS.find((o) => o.chave === origem)?.nome ?? ""}
              descricao="Lançado a dedo na Contabilidade (CB)"
              fatos={<FatosOrigem />}
              pessoas={QUEM_USOU}
              rotuloPessoas="Quem usou esta origem"
              onIsolar={setPessoa}
            />
          </div>
        </Bloco>
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Escada de idade"
          porque="Atraso entre fato e registro, idade do que foi apagado, tempo desde o último movimento: a mesma pergunta, então a mesma escada, do verde ao crítico, com as faixas vindas do domínio."
        >
          <div className="flex flex-col gap-4">
            <PainelEscada
              titulo="Idade do Que Foi Apagado"
              descricao="Quanto tempo o lançamento tinha quando foi excluído · Time todo"
              faixas={FAIXAS_IDADE}
              valores={[1210, 402, 148, 61, 19]}
              rotuloItem="Exclusões"
            />
            <Variante nome="Carregando">
              <PainelEscada titulo="Distribuição do Atraso" faixas={FAIXAS_IDADE} valores={undefined} rotuloItem="Lançamentos" carregando />
            </Variante>
          </div>
        </Bloco>
        <Bloco
          titulo="Curva de concentração"
          porque="Quanto do movimento cabe nas primeiras empresas. As marcas fixas (metade das empresas, 80% do movimento) dão a régua: sem elas a curva é bonita e não afirma nada."
        >
          <CurvaConcentracao pontos={PARETO} descricao="Metade dos lançamentos saiu de 64 empresas" />
        </Bloco>
      </div>

      <Bloco
        titulo="Carteira empresa por empresa"
        porque="O recorte Sem movimento é o motivo de a peça existir: empresa parada não aparece em ranking nenhum, porque ranking só lista quem produziu. O que ela conta entra por acessor (lançamentos no Contábil, notas no Fiscal), e busca e recorte leem a lista que já veio."
      >
        <TabelaCarteira
          linhas={CARTEIRA}
          itens={itensCarteira}
          faixas={FAIXAS_PARADA}
          rotuloItem="Lançamentos"
          rotuloPrincipal="Quem mais lançou"
        />
      </Bloco>

      <Bloco
        titulo="Situação do fechamento"
        porque="Sem movimento é neutro: empresa que não escriturou nada não deixou trabalho por fazer. Fora do Questor é cadastro a acertar, em azul de informação. Na fita, o mês vai escrito embaixo da barra, porque a pergunta de quem usa é quais meses estão fechados, e cor sozinha obriga a contar quadrados."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(["fechada", "aberta", "sem-movimento", "sem-par"] as SituacaoFechamento[]).map((s) => (
              <SeloFechamento key={s} situacao={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-8">
            {FITAS.map((f) => (
              <Variante key={f.nome} nome={f.nome}>
                <FitaCompetencias meses={MESES} situacoes={f.situacoes} referencia="2026-07-01" />
              </Variante>
            ))}
            <Variante nome="Virando o ano">
              <FitaCompetencias
                meses={["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]}
                situacoes={["fechada", "fechada", "aberta", "sem-par"]}
                referencia="2026-01-01"
              />
            </Variante>
          </div>
          <LegendaFechamento />
        </div>
      </Bloco>
    </>
  );
}
