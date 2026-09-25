import { secoesPostMortem } from "./postmortem";
import type { Secao } from "./tipos";

/**
 * Seções do Fiscal. Ao contrário da bancada do Contábil, o Fiscal lê o
 * escritório inteiro: toda aba varre o escopo, e empresa ou grupo no topo é
 * filtro, não obrigação. Filial vale nas seções que leem nota (o funil do
 * `buildWhere` recorta por `codigoestab`); a Produtividade segue a do Contábil
 * e não oferece filial.
 *
 * Espécie da nota e a métrica (valor ou quantidade) são filtros só do Fiscal:
 * moram na tela, não no contexto do topo, e valem pelo módulo inteiro
 * (`componentes/produto/fiscal/filtros`).
 *
 * Os ids e caminhos são os do nexo2: `cargo_secao` guarda esses ids, e link
 * salvo continua abrindo a mesma tela.
 */
export const SECOES_FISCAL: Secao[] = [
  {
    id: "painel",
    rotulo: "Painel",
    icone: "painel",
    grupo: "Visão",
    path: "/fiscal/painel",
    descricao: "Resumo da movimentação",
    abas: [
      {
        id: "painel",
        rotulo: "Painel",
        path: "/fiscal/painel",
        descricao: "Entradas, saídas, devoluções, espécies e impostos do período",
        empresa: "opcional",
        filial: true,
      },
    ],
  },
  {
    id: "analises",
    rotulo: "Análises",
    icone: "tendencia",
    grupo: "Visão",
    path: "/fiscal/analises",
    descricao: "Rankings e distribuições",
    abas: [
      {
        id: "analises",
        rotulo: "Análises",
        path: "/fiscal/analises",
        descricao: "Quem mais comprou e vendeu, produtos, CFOPs, estados, frete e faixas de valor",
        empresa: "opcional",
        filial: true,
      },
    ],
  },
  {
    id: "tributos",
    rotulo: "Tributos",
    icone: "moedas",
    grupo: "Rotina",
    path: "/fiscal/tributos",
    descricao: "Carga, DIFAL e regime",
    abas: [
      {
        id: "tributos",
        rotulo: "Tributos",
        path: "/fiscal/tributos",
        descricao: "Carga tributária, DIFAL por UF de destino, regime de PIS/COFINS e a carga de cada empresa",
        empresa: "opcional",
        filial: true,
      },
    ],
  },
  {
    id: "conformidade",
    rotulo: "Conformidade",
    icone: "escudo",
    grupo: "Rotina",
    path: "/fiscal/conformidade",
    descricao: "Pendências e saúde fiscal",
    abas: [
      {
        id: "conformidade",
        rotulo: "Conformidade",
        path: "/fiscal/conformidade",
        descricao: "NCM inválido, canceladas, denegadas e notas sem chave de acesso nas saídas",
        empresa: "opcional",
        filial: true,
      },
    ],
  },
  {
    // id "dados" é a chave de permissão desde o nexo2; o nome na tela é o do
    // Contábil, que serve o mesmo explorador.
    id: "dados",
    rotulo: "Notas Fiscais",
    icone: "nota",
    grupo: "Rotina",
    path: "/fiscal/dados",
    descricao: "Todas as notas do período, com itens",
    abas: [
      {
        id: "dados",
        rotulo: "Notas",
        path: "/fiscal/dados",
        descricao: "Todas as notas do período, com busca, contraparte e os itens de cada uma",
        empresa: "opcional",
        filial: true,
      },
    ],
  },
  {
    id: "produtividade",
    rotulo: "Produtividade",
    icone: "velocimetro",
    grupo: "Equipe",
    path: "/fiscal/produtividade",
    descricao: "O que o time escriturou, apurou e quanto tempo levou",
    abas: [
      {
        id: "lancamentos",
        rotulo: "Lançamentos",
        path: "/fiscal/produtividade",
        descricao: "Quem escriturou as notas do período, por pessoa, espécie, empresa, dia e hora",
        empresa: "opcional",
      },
      {
        id: "impostos",
        rotulo: "Impostos",
        path: "/fiscal/produtividade/impostos",
        descricao: "Quanto tributo passou pelas notas que cada pessoa escriturou",
        empresa: "opcional",
      },
      {
        id: "apuracao",
        rotulo: "Apuração",
        path: "/fiscal/produtividade/apuracao",
        descricao: "Quem apurou qual imposto de qual empresa, em que competência e com quanto atraso",
        empresa: "opcional",
      },
      {
        id: "atraso",
        rotulo: "Atraso",
        path: "/fiscal/produtividade/atraso",
        descricao: "Distância entre a data do documento e o dia em que a nota foi escriturada",
        empresa: "opcional",
      },
      {
        id: "carteira",
        rotulo: "Carteira",
        path: "/fiscal/produtividade/carteira",
        descricao: "Empresas atendidas no período, empresas paradas e há quanto tempo",
        empresa: "opcional",
      },
      {
        id: "tempo",
        rotulo: "Tempo",
        path: "/fiscal/produtividade/tempo",
        descricao: "Horas dentro do Questor por pessoa e por empresa, contra as notas do período",
        empresa: "opcional",
      },
      {
        id: "app",
        rotulo: "No NaveX",
        path: "/fiscal/produtividade/app",
        descricao: "Varreduras executadas, notas abertas e exportações feitas aqui dentro",
        empresa: "opcional",
      },
    ],
  },
  ...secoesPostMortem("fiscal", "Equipe"),
];
