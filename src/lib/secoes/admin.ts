import { abaAutonoma, type Secao } from "./tipos";

/**
 * Seções da Administração. É o único módulo que nenhum cargo concede: quem
 * entra é quem tem um cargo de acesso total (ver `soAdmin` em `modulos.ts`).
 * Por isso as seções não aparecem na matriz de permissões do cargo.
 *
 * Os caminhos são os do nexo2 (`/admin/usuarios`...). No nexo2 era uma área à
 * parte, com casca própria; aqui ela usa a moldura dos módulos para a busca, a
 * troca de módulo e o menu da pessoa valerem igual.
 */
function secao(id: string, rotulo: string, icone: string, grupo: string, descricao: string): Secao {
  const path = `/admin/${id}`;
  return { id, rotulo, icone, grupo, path, descricao, abas: [abaAutonoma(id, rotulo, path, descricao)] };
}

export const SECOES_ADMIN: Secao[] = [
  secao("usuarios", "Usuários", "pessoas", "Acesso", "Quem entra no NaveX e com que cargos"),
  secao("cargos", "Cargos", "chave", "Acesso", "As seções e as empresas que cada cargo libera"),
  secao("setores", "Setores", "camadas", "Acesso", "Os setores que agrupam os cargos"),
  // "Grupos de Permissão" e não "Grupos de Empresa": o nome de tela do nexo2
  // era o mesmo dos grupos de negócio das Configurações (a U FIT), que são
  // outra coisa (tabela `grupo_empresarial`). Estes são o escopo de empresas
  // que um cargo enxerga (tabela `empresa_grupo`).
  secao("grupos", "Grupos de Permissão", "empresa", "Acesso", "As empresas que cada cargo enxerga"),
  secao("auditoria", "Auditoria", "historico", "Registro", "Quem viu, gerou e exportou o quê"),
];
