import { abaAutonoma, type Secao } from "./tipos";

/**
 * Seções de Configurações: cadastros de domínio que as telas dos outros
 * módulos leem, gateados por cargo como qualquer seção. Não é a Administração
 * (usuários, cargos, grupos de permissão), que é só de admin.
 *
 * O id e o caminho são os do nexo2: `cargo_secao` guarda `config/grupos-empresa`.
 */
export const SECOES_CONFIG: Secao[] = [
  {
    id: "grupos-empresa",
    rotulo: "Grupos de Empresa",
    icone: "camadas",
    grupo: "Cadastros",
    path: "/config/grupos-empresa",
    descricao: "Empresas agrupadas por grupo de negócio",
    abas: [
      abaAutonoma(
        "grupos-empresa",
        "Grupos de Empresa",
        "/config/grupos-empresa",
        "Os grupos de negócio, como a U FIT, que o seletor de empresa e o Post Mortem usam"
      ),
    ],
  },
];
