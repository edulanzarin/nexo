import type { ModuloId } from "./modulos";

/**
 * Os setores que preenchem o Relatório Post Mortem, e o que muda de um para o
 * outro. É a FONTE de quais setores existem: as seções do módulo do setor, o
 * gate da API e o formulário partem daqui.
 *
 * O relatório NÃO tem módulo próprio: ele mora dentro do módulo do setor que o
 * preenche (`modulo`), e é isso que deixa o gestor de cada área ler a área dele
 * sem ler a do vizinho — a permissão já é por módulo/seção. Setor novo, por
 * isso, precisa de um módulo onde morar; enquanto ele não existir, não há onde
 * pendurar a seção.
 *
 * O tronco do relatório é o mesmo para todo mundo (identificação, descrição,
 * impactos, causa raiz, ações, lições): o que um post mortem faz não muda com o
 * setor. O que muda são POUCOS campos, e é isso que `campos` declara — sem essa
 * lista, "o Societário não tem funcionários afetados" viraria um `if (setor ===
 * 'societario')` espalhado pelo formulário.
 */
export const CAMPOS_PM = [
  "funcionariosAfetados",
  "impactoTrabalhista",
  "impactoFuncionarios",
  "gravidade",
  "responsavelInfo",
] as const;

export type CampoPM = (typeof CAMPOS_PM)[number];

export interface SetorPM {
  id: string;
  rotulo: string;
  descricao: string;
  /** Módulo do Nexo onde as seções deste setor moram. */
  modulo: ModuloId;
  /** Campos opcionais que ESTE setor mostra, além do tronco comum. */
  campos: CampoPM[];
}

/**
 * O formulário nasceu no DP, e o recorte de pessoal (quantos funcionários,
 * impacto trabalhista, impacto ao funcionário) veio de lá. Fiscal e Contábil
 * herdam o mesmo — erro deles também atinge gente — enquanto ninguém pedir
 * diferente.
 */
const CAMPOS_PESSOAL: CampoPM[] = [
  "funcionariosAfetados",
  "impactoTrabalhista",
  "impactoFuncionarios",
];

export const SETORES_PM: SetorPM[] = [
  {
    id: "dp",
    rotulo: "DP",
    descricao: "Departamento Pessoal: folha, admissão, rescisão e eSocial",
    // O módulo do DP se chama `folha` (o id é antigo, o rótulo é "DP").
    modulo: "folha",
    campos: CAMPOS_PESSOAL,
  },
  {
    id: "fiscal",
    rotulo: "Fiscal",
    descricao: "Notas, apurações, guias e declarações",
    modulo: "fiscal",
    campos: CAMPOS_PESSOAL,
  },
  {
    id: "contabil",
    rotulo: "Contábil",
    descricao: "Lançamentos, balancetes e conciliação",
    modulo: "contabil",
    campos: CAMPOS_PESSOAL,
  },
  // Pedido do Societário (set/2026): sai o recorte de pessoal, que não é o erro
  // deles, e entram a nota de gravidade (1 baixo … 5 gravíssimo) e quem avisou
  // que o erro aconteceu. O módulo Societário nasceu junto, e por ora só tem o
  // post mortem dentro.
  {
    id: "societario",
    rotulo: "Societário",
    descricao: "Contratos, alterações, aberturas e baixas",
    modulo: "societario",
    campos: ["gravidade", "responsavelInfo"],
  },
];

export function setorPM(id: string): SetorPM | undefined {
  return SETORES_PM.find((s) => s.id === id);
}

/**
 * O setor que preenche o post mortem DESTE módulo. É a volta que as telas e as
 * rotas fazem: elas sabem em que módulo estão (o caminho diz), e precisam do
 * setor para recortar a lista.
 */
export function setorDoModulo(modulo: string): SetorPM | undefined {
  return SETORES_PM.find((s) => s.modulo === modulo);
}

export function setorValido(id: string): boolean {
  return SETORES_PM.some((s) => s.id === id);
}

/** Rótulo do setor para lista e cabeçalho; o id cru se o setor sumiu do catálogo. */
export function rotuloSetor(id: string): string {
  return setorPM(id)?.rotulo ?? id;
}

/** Este setor mostra (e cobra) este campo? */
export function temCampo(setorId: string, campo: CampoPM): boolean {
  return setorPM(setorId)?.campos.includes(campo) ?? false;
}
