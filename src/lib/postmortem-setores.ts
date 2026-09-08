/**
 * Os setores que preenchem o Relatório Post Mortem, e o que muda de um para o
 * outro. É a FONTE de quais setores existem: a seção do módulo, o gate da API e
 * o formulário partem daqui, então setor novo é uma entrada nesta lista (não uma
 * migration — a coluna `setor` do banco é texto livre de propósito).
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
    campos: CAMPOS_PESSOAL,
  },
  {
    id: "fiscal",
    rotulo: "Fiscal",
    descricao: "Notas, apurações, guias e declarações",
    campos: CAMPOS_PESSOAL,
  },
  {
    id: "contabil",
    rotulo: "Contábil",
    descricao: "Lançamentos, balancetes e conciliação",
    campos: CAMPOS_PESSOAL,
  },
  // Pedido do Societário (set/2026): sai o recorte de pessoal, que não é o erro
  // deles, e entram a nota de gravidade (1 baixo … 5 gravíssimo) e quem avisou
  // que o erro aconteceu.
  {
    id: "societario",
    rotulo: "Societário",
    descricao: "Contratos, alterações, aberturas e baixas",
    campos: ["gravidade", "responsavelInfo"],
  },
];

export function setorPM(id: string): SetorPM | undefined {
  return SETORES_PM.find((s) => s.id === id);
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
