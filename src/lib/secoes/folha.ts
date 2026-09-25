import { DP_FAMILIAS } from "../dp-tipos";
import { secoesPostMortem } from "./postmortem";
import { abaAutonoma, type Secao } from "./tipos";

/**
 * Seções do DP (o módulo `folha`). Três jeitos de ler o Questor convivem aqui:
 * - os painéis carregam sozinhos, com janelas próprias (sem empresa nem período);
 * - Rotatividade, Custo de Folha, Férias e eSocial são bancada: uma empresa por
 *   vez, porque cada uma varre a folha inteira da empresa;
 * - Rescisões e Produtividade são o retrato do escritório: empresa ou grupo no
 *   topo é filtro, não obrigação.
 *
 * Nenhuma oferece filial. A Rotatividade tem o estabelecimento no filtro dela
 * (pelo nome, junto com setor, cargo, vínculo e horário); as outras não recortam
 * por estabelecimento.
 *
 * Os ids e caminhos são os do nexo2: `cargo_secao` guarda esses ids, e link
 * salvo continua abrindo a mesma tela.
 */
export const SECOES_FOLHA: Secao[] = [
  // Gestão antes do painel do analista: admin alcança os dois, e a entrada do
  // módulo cai na primeira seção visível.
  {
    id: "painel-gestao",
    rotulo: "Painel da Equipe",
    icone: "painel",
    grupo: "Visão",
    path: "/folha/painel-gestao",
    descricao: "Pendências e atividade do DP no mês",
    abas: [
      abaAutonoma(
        "painel-gestao",
        "Painel da Equipe",
        "/folha/painel-gestao",
        "Pendências do DP, a atividade do mês contra o anterior e quem mais trabalhou"
      ),
    ],
  },
  {
    id: "painel",
    rotulo: "Meu Painel",
    icone: "grade",
    grupo: "Visão",
    path: "/folha/painel",
    descricao: "Rescisões a pagar, férias vencidas e eSocial",
    abas: [
      abaAutonoma(
        "painel",
        "Meu Painel",
        "/folha/painel",
        "Rescisões a pagar, férias vencidas, eSocial rejeitado e os casos mais urgentes"
      ),
    ],
  },
  {
    id: "rescisoes",
    rotulo: "Rescisões a Pagar",
    icone: "recibo",
    grupo: "Rotina",
    path: "/folha/rescisoes",
    descricao: "Prazo de pagamento e avisos por e-mail",
    abas: [
      {
        id: "rescisoes",
        rotulo: "Rescisões a Pagar",
        path: "/folha/rescisoes",
        descricao: "Desligamentos do período com o prazo de pagamento, o que já foi pago e quem recebe os avisos",
        empresa: "opcional",
      },
    ],
  },
  {
    id: "ferias",
    rotulo: "Férias",
    icone: "calendario",
    grupo: "Rotina",
    path: "/folha/ferias",
    descricao: "Férias vencidas e a vencer",
    abas: [
      {
        id: "ferias",
        rotulo: "Férias",
        path: "/folha/ferias",
        descricao: "Quem tem férias vencidas ou a vencer no último dia do período",
      },
    ],
  },
  {
    id: "esocial",
    rotulo: "eSocial",
    icone: "escudo",
    grupo: "Rotina",
    path: "/folha/esocial",
    descricao: "Eventos aceitos, pendentes e rejeitados",
    abas: [
      {
        id: "esocial",
        rotulo: "eSocial",
        path: "/folha/esocial",
        descricao: "Eventos transmitidos no período e admissões ou rescisões sem o evento aceito",
      },
    ],
  },
  {
    id: "rotatividade",
    rotulo: "Rotatividade",
    icone: "rotatividade",
    grupo: "Análise",
    path: "/folha/rotatividade",
    descricao: "Admissões e desligamentos sobre o efetivo",
    abas: [
      {
        id: "rotatividade",
        rotulo: "Rotatividade",
        path: "/folha/rotatividade",
        descricao: "Turnover da empresa, quem entrou e saiu, e a quebra por setor, cargo, horário e perfil",
      },
    ],
  },
  {
    id: "custo",
    rotulo: "Custo de Folha",
    icone: "moedas",
    grupo: "Análise",
    path: "/folha/custo",
    descricao: "Proventos por rubrica, tipo e setor",
    abas: [
      {
        id: "custo",
        rotulo: "Custo de Folha",
        path: "/folha/custo",
        descricao: "Proventos, descontos e líquido das folhas do período, por rubrica, tipo, setor e cargo",
      },
    ],
  },
  {
    id: "produtividade",
    rotulo: "Produtividade",
    icone: "velocimetro",
    grupo: "Equipe",
    path: "/folha/produtividade",
    descricao: "Movimentação, férias, folha e eSocial por colaborador",
    // Uma aba por família de trabalho, e não por trabalho: doze abas seriam uma
    // lista, não uma navegação. O trabalho vira escolha dentro da família. As
    // seis leem o mesmo resumo, então executar numa executa todas.
    abas: [
      {
        id: "geral",
        rotulo: "Visão Geral",
        path: "/folha/produtividade",
        descricao: "O que o DP fez no período, por família de trabalho e por pessoa",
        empresa: "opcional",
        execucaoCompartilhada: "/folha/produtividade",
      },
      ...DP_FAMILIAS.map((f) => ({
        id: f.id,
        rotulo: f.rotulo,
        path: `/folha/produtividade/${f.id}`,
        descricao: f.descricao,
        empresa: "opcional" as const,
        execucaoCompartilhada: "/folha/produtividade",
      })),
    ],
  },
  ...secoesPostMortem("folha", "Equipe"),
];
