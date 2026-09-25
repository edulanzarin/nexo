import { secoesPostMortem } from "./postmortem";
import { abaAutonoma, type Secao } from "./tipos";

/**
 * Seções do Contábil. A ordem é a da barra lateral, e os grupos seguem o dia
 * do analista: o que acompanhar, a bancada de cada empresa, os balancetes, a
 * revisão, o cadastro da empresa e o que é da equipe.
 *
 * Os caminhos são os do nexo2, para link salvo e atalho continuarem abrindo a
 * mesma tela depois da troca.
 */
export const SECOES_CONTABIL: Secao[] = [
  // Gestão vem antes do painel pessoal: admin alcança os dois, e a entrada do
  // módulo cai na primeira seção visível.
  {
    id: "painel-gestao",
    rotulo: "Painel da Equipe",
    icone: "painel",
    grupo: "Visão",
    path: "/contabil/painel-gestao",
    descricao: "Atividade do time no mês, série de seis meses e a base configurada",
    abas: [
      abaAutonoma(
        "painel-gestao",
        "Painel da Equipe",
        "/contabil/painel-gestao",
        "Atividade do time no mês, série de seis meses e a base configurada"
      ),
    ],
  },
  {
    id: "painel",
    rotulo: "Meu Painel",
    icone: "grade",
    grupo: "Visão",
    path: "/contabil/painel",
    descricao: "O que você rodou no mês e a base configurada",
    abas: [
      abaAutonoma("painel", "Meu Painel", "/contabil/painel", "O que você rodou no mês e a base configurada"),
    ],
  },
  {
    id: "conciliacao",
    rotulo: "Conciliação Bancária",
    icone: "banco",
    grupo: "Rotina",
    path: "/contabil/conciliacao",
    descricao: "Extrato do banco vira lançamento",
    abas: [
      {
        id: "importar",
        rotulo: "Importar Extrato",
        path: "/contabil/conciliacao",
        descricao: "Leia o OFX ou o PDF do banco e gere o arquivo de lançamentos",
        periodo: "nenhum",
        execucao: null,
      },
      {
        id: "regras",
        rotulo: "Regras",
        path: "/contabil/conciliacao/regras",
        descricao: "A contrapartida de cada descrição do extrato",
        periodo: "nenhum",
        execucao: null,
      },
    ],
  },
  {
    id: "conferencia",
    rotulo: "Conferência Fiscal",
    icone: "conferencia",
    grupo: "Rotina",
    path: "/contabil/conferencia",
    descricao: "Notas fiscais contra a contabilidade",
    abas: [
      {
        id: "conferencia",
        rotulo: "Conferência",
        path: "/contabil/conferencia",
        descricao: "Notas não contabilizadas, na conta errada, em bloco ou duplicadas",
        filial: true,
      },
      {
        id: "configuracao",
        rotulo: "Plano de Contabilização",
        path: "/contabil/configuracao",
        descricao: "Como cada CFOP é lançado nesta empresa",
        periodo: "nenhum",
        execucao: "Carregar",
      },
    ],
  },
  {
    id: "pendencias",
    rotulo: "Central de Pendências",
    icone: "fila",
    grupo: "Rotina",
    path: "/contabil/pendencias",
    descricao: "Conferência e auditoria numa fila só, para resolver ou ignorar",
    abas: [
      {
        id: "pendencias",
        rotulo: "Pendências",
        path: "/contabil/pendencias",
        descricao: "Notas com problema e lançamentos anômalos do período",
      },
    ],
  },
  {
    id: "notas",
    rotulo: "Notas Fiscais",
    icone: "nota",
    grupo: "Rotina",
    path: "/contabil/notas",
    descricao: "Todas as notas do período, com itens",
    abas: [
      {
        id: "notas",
        rotulo: "Notas",
        path: "/contabil/notas",
        descricao: "Todas as notas do período, com itens e produtos",
        filial: true,
      },
    ],
  },
  {
    id: "balancete",
    rotulo: "Balancete Fiscal",
    icone: "balanca",
    grupo: "Balancetes",
    path: "/contabil/balancete-fiscal",
    descricao: "O que as regras esperam contra o que foi lançado",
    abas: [
      {
        id: "balancete",
        rotulo: "Balancete Fiscal",
        path: "/contabil/balancete-fiscal",
        descricao: "Movimento esperado pelas regras de cada CFOP, conta a conta, contra o contábil",
        filial: true,
      },
    ],
  },
  {
    // id "analise" é a chave de permissão da seção desde o nexo2.
    id: "analise",
    rotulo: "Balancete Contábil",
    icone: "planilha",
    grupo: "Balancetes",
    path: "/contabil/balancete-contabil",
    descricao: "Balancete de verificação e a leitura dele",
    abas: [
      {
        id: "balancete",
        rotulo: "Balancete",
        path: "/contabil/balancete-contabil",
        descricao: "Saldo anterior, movimento do mês e saldo atual, conta a conta",
        periodo: "mes",
        execucao: "Gerar",
      },
      {
        id: "analise",
        rotulo: "Análise",
        path: "/contabil/balancete-contabil/analise",
        descricao: "Indicadores, alertas e recomendações sobre o balancete",
        periodo: "mes",
        execucao: "Analisar",
      },
    ],
  },
  {
    id: "auditoria",
    rotulo: "Auditoria de Lançamentos",
    icone: "lupa",
    grupo: "Revisão",
    path: "/contabil/auditoria",
    descricao: "Lançamentos com anomalia no período",
    abas: [
      {
        id: "auditoria",
        rotulo: "Auditoria",
        path: "/contabil/auditoria",
        descricao: "Varredura do razão: conta sintética, fora do plano, sem histórico e partida repetida",
      },
    ],
  },
  {
    id: "funcionarios",
    rotulo: "Funcionários",
    icone: "pessoas",
    grupo: "Empresa",
    path: "/contabil/funcionarios",
    descricao: "Quadro da empresa pela folha do Questor",
    abas: [
      {
        id: "funcionarios",
        rotulo: "Funcionários",
        path: "/contabil/funcionarios",
        descricao: "Vínculo, cargo, setor e admissão de cada funcionário",
        periodo: "nenhum",
        execucao: "Carregar",
      },
    ],
  },
  {
    id: "implantacao",
    rotulo: "Implantação",
    icone: "importar",
    grupo: "Empresa",
    path: "/contabil/implantacao",
    descricao: "Balancete e bens da contabilidade anterior viram arquivos do Questor",
    abas: [
      {
        id: "implantar",
        rotulo: "Saldos",
        path: "/contabil/implantacao",
        descricao: "O balancete anterior em PDF vira o arquivo de saldos",
        periodo: "nenhum",
        execucao: null,
      },
      {
        id: "patrimonial",
        rotulo: "Patrimonial",
        path: "/contabil/implantacao/patrimonial",
        descricao: "O relatório de bens em PDF vira o arquivo do patrimonial",
        periodo: "nenhum",
        execucao: null,
      },
    ],
  },
  {
    id: "produtividade",
    rotulo: "Produtividade",
    icone: "velocimetro",
    grupo: "Equipe",
    path: "/contabil/produtividade",
    descricao: "O que o time produziu, apagou, fechou e quanto tempo levou",
    // Única seção que varre o escritório inteiro: empresa e grupo são filtro.
    abas: [
      {
        id: "lancamentos",
        rotulo: "Lançamentos",
        path: "/contabil/produtividade",
        descricao: "Quem alimentou a contabilidade, por pessoa, origem, empresa, dia e hora",
        empresa: "opcional",
      },
      {
        id: "exclusoes",
        rotulo: "Exclusões",
        path: "/contabil/produtividade/exclusoes",
        descricao: "O que foi apagado do razão, quem apagou e que idade o lançamento tinha",
        empresa: "opcional",
      },
      {
        id: "fechamento",
        rotulo: "Fechamento",
        path: "/contabil/produtividade/fechamento",
        descricao: "Quais empresas tiveram o mês apurado, de quem são e quem apurou",
        empresa: "opcional",
      },
      {
        id: "atraso",
        rotulo: "Atraso",
        path: "/contabil/produtividade/atraso",
        descricao: "Distância entre a competência do fato e o dia do registro",
        empresa: "opcional",
      },
      {
        id: "carteira",
        rotulo: "Carteira",
        path: "/contabil/produtividade/carteira",
        descricao: "Empresas atendidas no período, empresas paradas e há quanto tempo",
        empresa: "opcional",
      },
      {
        id: "tempo",
        rotulo: "Tempo",
        path: "/contabil/produtividade/tempo",
        descricao: "Horas dentro do Questor por pessoa e por empresa",
        empresa: "opcional",
      },
      {
        id: "app",
        rotulo: "No NaveX",
        path: "/contabil/produtividade/app",
        descricao: "Conciliações, laudos, implantações e triagens rodadas aqui dentro",
        empresa: "opcional",
      },
    ],
  },
  ...secoesPostMortem("contabil", "Equipe"),
];
