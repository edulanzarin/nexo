import { abaAutonoma, type Secao } from "./tipos";

/**
 * Seções do RH, o módulo interno da Navecon. O dado é fixo nas empresas da
 * própria Navecon (`EMPRESAS_RH`), então nenhuma aba lê a empresa do contexto
 * do topo: quem recorta por empresa (Diretório, Experiência, Rotatividade) tem a
 * escolha dentro da tela, entre as três e "Todas".
 *
 * Quase tudo carrega sozinho: são três empresas e um banco do app pequeno. Só a
 * Rotatividade lê o período do topo e pede Executar, igual à do DP.
 *
 * Os ids e caminhos são os do nexo2: `cargo_secao` guarda esses ids, e link
 * salvo continua abrindo a mesma tela.
 */
export const SECOES_RH: Secao[] = [
  {
    id: "painel",
    rotulo: "Painel",
    icone: "painel",
    grupo: "Visão",
    path: "/rh/painel",
    descricao: "Pendências e panorama do mês",
    abas: [
      abaAutonoma(
        "painel",
        "Painel",
        "/rh/painel",
        "Experiências a decidir, denúncias abertas, avaliações em andamento e o que o RH fez no mês"
      ),
    ],
  },
  {
    id: "diretorio",
    rotulo: "Diretório",
    icone: "pessoas",
    grupo: "Pessoas",
    path: "/rh/diretorio",
    descricao: "Funcionários, com filtro e ficha",
    abas: [
      abaAutonoma(
        "diretorio",
        "Diretório",
        "/rh/diretorio",
        "Quem trabalha na Navecon hoje, do Questor e os PJ, com setor, cargo e e-mail"
      ),
    ],
  },
  {
    id: "experiencia",
    rotulo: "Experiência",
    icone: "calendario",
    grupo: "Pessoas",
    path: "/rh/experiencia",
    descricao: "Avaliação de 45 e 90 dias",
    abas: [
      abaAutonoma(
        "experiencia",
        "Experiência",
        "/rh/experiencia",
        "Contratos em experiência, o prazo de cada marco e a decisão dos gestores"
      ),
    ],
  },
  {
    id: "desempenho",
    rotulo: "Desempenho",
    icone: "tendencia",
    grupo: "Pessoas",
    path: "/rh/desempenho",
    descricao: "Avaliação respondida pelos gestores",
    abas: [
      abaAutonoma(
        "desempenho",
        "Desempenho",
        "/rh/desempenho",
        "Avaliações de desempenho por rodada, com as respostas de cada gestor"
      ),
    ],
  },
  {
    id: "rotatividade",
    rotulo: "Rotatividade",
    icone: "rotatividade",
    grupo: "Pessoas",
    path: "/rh/rotatividade",
    descricao: "Turnover das empresas do RH",
    abas: [
      {
        id: "rotatividade",
        rotulo: "Rotatividade",
        path: "/rh/rotatividade",
        descricao: "Turnover da Navecon, quem entrou e saiu, e a quebra por setor, cargo, horário e perfil",
        empresa: "nenhuma",
      },
    ],
  },
  {
    id: "formularios",
    rotulo: "Formulários",
    icone: "relatorio",
    grupo: "Canais",
    path: "/rh/formularios",
    descricao: "Formulários e envios aos gestores",
    abas: [
      abaAutonoma(
        "formularios",
        "Formulários",
        "/rh/formularios",
        "Os formulários do RH, com as perguntas e a prévia de como chegam a quem responde"
      ),
      abaAutonoma(
        "envios",
        "Envios",
        "/rh/formularios/envios",
        "Formulários enviados, para quem foram e quem já respondeu"
      ),
      abaAutonoma(
        "automatico",
        "Automático",
        "/rh/formularios/automatico",
        "Envios que se repetem sozinhos, por setor ou por pessoa"
      ),
    ],
  },
  {
    id: "denuncias",
    rotulo: "Denúncias",
    icone: "escudo",
    grupo: "Canais",
    path: "/rh/denuncias",
    descricao: "Canal anônimo, com fila e tratativa",
    abas: [
      abaAutonoma(
        "denuncias",
        "Denúncias",
        "/rh/denuncias",
        "Relatos do canal anônimo, a situação de cada um e a conversa com quem denunciou"
      ),
    ],
  },
  {
    id: "clima",
    rotulo: "Avaliações",
    icone: "coracao",
    grupo: "Canais",
    path: "/rh/clima",
    descricao: "Avaliação anônima da empresa",
    abas: [
      abaAutonoma(
        "clima",
        "Avaliações",
        "/rh/clima",
        "Rodadas da avaliação anônima da empresa, o resumo de cada uma e as respostas"
      ),
    ],
  },
  {
    id: "gestores",
    rotulo: "Gestores",
    icone: "usuario",
    grupo: "Cadastro",
    path: "/rh/gestores",
    descricao: "Supervisores e coordenadores por setor",
    abas: [
      abaAutonoma(
        "gestores",
        "Gestores",
        "/rh/gestores",
        "Quem recebe os formulários de cada setor, e os setores criados no RH"
      ),
    ],
  },
];
