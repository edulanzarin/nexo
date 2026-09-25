import { abaAutonoma, type Secao } from "./tipos";

/**
 * Seções da TI. Começa pelos Equipamentos: o inventário, com quem está cada um
 * e o histórico de entregas e devoluções. As três abas leem o mesmo cadastro e
 * dividem a permissão da seção, então quem cuida do inventário vê tudo dele.
 *
 * Nada aqui lê empresa nem período do topo: o inventário é da Navecon, e o
 * volume (algumas centenas de itens) vem inteiro e se recorta na tela.
 */
export const SECOES_TI: Secao[] = [
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
];
