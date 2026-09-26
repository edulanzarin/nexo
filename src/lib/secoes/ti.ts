import { abaAutonoma, type Secao } from "./tipos";

/**
 * Seções da TI: o Painel, os Equipamentos (o inventário, com quem está cada um
 * e o histórico de entregas e devoluções) e os Acessos (o cofre das senhas da
 * infraestrutura e o registro de quem abriu cada uma).
 *
 * Equipamentos e Acessos são seções separadas de propósito: a seção é a
 * unidade de permissão, e quem entrega notebook não precisa abrir a senha do
 * banco de dados. As abas de cada uma dividem a permissão dela.
 *
 * Nada aqui lê empresa nem período do topo: é tudo da Navecon, e o volume
 * (algumas centenas de linhas) vem inteiro e se recorta na tela.
 */
export const SECOES_TI: Secao[] = [
  {
    id: "painel",
    rotulo: "Painel",
    icone: "painel",
    grupo: "Visão",
    path: "/ti/painel",
    descricao: "Pendências e o que aconteceu por último",
    abas: [
      abaAutonoma(
        "painel",
        "Painel",
        "/ti/painel",
        "O que pede ação na TI e o que aconteceu por último"
      ),
    ],
  },
  {
    id: "equipamentos",
    rotulo: "Equipamentos",
    icone: "notebook",
    grupo: "Inventário",
    path: "/ti/equipamentos",
    descricao: "Notebooks, periféricos e com quem está cada um",
    abas: [
      abaAutonoma(
        "inventario",
        "Inventário",
        "/ti/equipamentos",
        "Cada equipamento, com quem está, desde quando e as especificações"
      ),
      abaAutonoma(
        "pessoas",
        "Por Pessoa",
        "/ti/equipamentos/pessoas",
        "O que cada pessoa tem em mãos, e quem está sem equipamento"
      ),
      abaAutonoma(
        "movimentacoes",
        "Movimentações",
        "/ti/equipamentos/movimentacoes",
        "Entregas, devoluções, manutenções e baixas, da mais recente para trás"
      ),
    ],
  },
  {
    id: "acessos",
    rotulo: "Acessos",
    icone: "cofre",
    grupo: "Inventário",
    path: "/ti/acessos",
    descricao: "Senhas do Wi-Fi, dos sistemas, dos bancos e do acesso remoto",
    abas: [
      abaAutonoma(
        "cofre",
        "Cofre",
        "/ti/acessos",
        "Cada acesso da infraestrutura, com endereço, porta, usuário e a senha guardada com cifra"
      ),
      abaAutonoma(
        "registro",
        "Registro",
        "/ti/acessos/registro",
        "Quem viu, copiou ou trocou cada senha, e quando"
      ),
    ],
  },
];
