import type { ClasseInfo, ProdItem } from "./prod-tipos";

/**
 * Tipos e catálogo da aba IMPOSTOS da Produtividade do Fiscal — o PESO do que
 * cada pessoa escriturou.
 *
 * As outras abas contam notas. Esta pergunta quanto tributo passou pela mão de
 * cada um: mil NFC-e de padaria e mil NF-e de indústria são o mesmo número na
 * aba Lançamentos e coisas muito diferentes aqui. É o que impede a leitura
 * ingênua de "produtividade = volume".
 *
 * No Questor não existe uma coluna de imposto: cada tributo mora numa tabela de
 * detalhe própria (item, PIS/COFINS, retenção, DIFAL) — ver [[Impostos no
 * Questor - onde fica cada um]]. Por isso a aba é uma varredura POR TRIBUTO,
 * todas em paralelo, e o cruzamento acontece em Node.
 *
 * O que esta tela NÃO é: apuração. Débito de saída menos crédito de entrada dá
 * uma estimativa gerencial, não o número oficial (que depende de ajustes e
 * estornos dos blocos E100/E110). A tela mostra os dois lados separados e não
 * subtrai um do outro — passar número que parece apuração e não é seria pior do
 * que não mostrar.
 */

/**
 * Um tributo somado por pessoa. `lado` diz onde ele existe: DIFAL só nas saídas,
 * o resto nos dois. Paleta categórica — tributo é categoria, não juízo.
 */
export interface TributoInfo extends ClasseInfo {
  lado: "ent" | "sai" | "ambos";
}

export const TRIBUTOS: TributoInfo[] = [
  { id: "icms", rotulo: "ICMS", descricao: "Item da nota (valoricms)", cor: "var(--esp-1)", lado: "ambos" },
  { id: "ipi", rotulo: "IPI", descricao: "Item da nota (valoripi)", cor: "var(--esp-2)", lado: "ambos" },
  { id: "st", rotulo: "ICMS-ST", descricao: "Substituição tributária", cor: "var(--esp-4)", lado: "ambos" },
  { id: "iss", rotulo: "ISS", descricao: "Serviço, no item da nota", cor: "var(--esp-3)", lado: "ambos" },
  { id: "pis", rotulo: "PIS", descricao: "Tabela própria, por produto", cor: "var(--esp-5)", lado: "ambos" },
  { id: "cofins", rotulo: "COFINS", descricao: "Tabela própria, por produto", cor: "var(--esp-outras)", lado: "ambos" },
  {
    id: "retido",
    rotulo: "Retenções",
    descricao: "IRRF, INSS, CSLL e ISSQN retidos na nota de serviço",
    cor: "color-mix(in oklab, var(--esp-1) 50%, var(--esp-5))",
    lado: "ambos",
  },
  {
    id: "difal",
    rotulo: "DIFAL e FCP",
    descricao: "Diferencial de alíquota e fundo de pobreza — só saídas",
    cor: "color-mix(in oklab, var(--esp-2) 50%, var(--esp-4))",
    lado: "sai",
  },
];

export type PorTributo = Record<string, number>;

export const zeroTributos = (): PorTributo =>
  Object.fromEntries(TRIBUTOS.map((t) => [t.id, 0]));

/** Um tributo no período, com os dois lados separados (nunca subtraídos). */
export interface FisTributoItem {
  id: string;
  rotulo: string;
  cor: string;
  entradas: number;
  saidas: number;
  total: number;
}

export interface FisImpPessoa {
  codigo: number;
  nome: string;
  inativo: boolean;
  notas: number;
  /** Soma de todos os tributos das notas dela — o "peso" do que escriturou. */
  total: number;
  entradas: number;
  saidas: number;
  empresas: number;
  /** Tributo por real de nota — densidade fiscal do que cai na mão dela. */
  porNota: number;
  porTributo: PorTributo;
  topEmpresas: ProdItem[];
}

/** Uma empresa e o tributo que ela deu de trabalho no período. */
export interface FisImpEmpresa extends ProdItem {
  /** Quantas pessoas do time tocaram nela. */
  pessoas: number;
  porTributo: PorTributo;
}

export interface FiscalImpostosResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: {
    notas: number;
    /** Valor contábil das notas — a base sobre a qual o tributo incide. */
    valor: number;
    total: number;
    entradas: number;
    saidas: number;
    pessoas: number;
    empresas: number;
  };
  tributos: FisTributoItem[];
  ranking: FisImpPessoa[];
  empresas: FisImpEmpresa[];
  serie: ({ bucket: string; total: number } & Record<string, string | number>)[];
}
