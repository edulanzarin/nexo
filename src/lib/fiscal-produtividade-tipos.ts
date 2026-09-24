import type {
  ClasseInfo,
  PorClasseGen,
  ProdCalendario,
  ProdDia,
  ProdItem,
  SeriePontoGen,
} from "./prod-tipos";

/**
 * Tipos e catálogo da PRODUTIVIDADE DO FISCAL — "quem escriturou o quê" nas
 * notas do período. Fora do `fiscal-produtividade.ts` (server-only) porque a
 * interface também precisa do catálogo de espécies e das cores.
 *
 * O RECORTE É `datahoralctofis` (quando a nota foi lançada), não `datalctofis`
 * (a data do documento). No Questor as duas colunas são coisas diferentes, e a
 * distância entre elas é grande: em jul/2026, das 591 mil saídas com documento
 * daquele mês, NENHUMA tinha sido digitada no próprio mês — a defasagem típica
 * é de 18 a 33 dias, porque o fiscal fecha o mês passado no mês seguinte.
 * Medir produtividade por `datalctofis` responderia "que competência estamos
 * olhando", não "quem trabalhou este mês". Mesma doutrina da Produtividade do
 * Contábil e do DP. Ver [[Modelo de dados fiscais do Questor]].
 *
 * O preço: `datahoralctofis` não tem índice (só `(empresa, estab, datalctofis)`
 * tem), então a varredura é sequencial. Medido: ~4,5 s para o escritório inteiro
 * num mês — o mesmo custo do Contábil, e a tela roda no botão Executar.
 */

/**
 * ESPÉCIE da nota — a dimensão categórica da seção, o equivalente fiscal da
 * "natureza do lançamento" do Contábil. É por ela que se vê de que é feito o
 * total: um mês de 1 milhão de NFCe de varejo não é o mesmo trabalho que 20 mil
 * NFS-e, que ainda pedem decisão de conta a conta.
 *
 * Paleta CATEGÓRICA (`--esp-*`), a mesma que o resto do Fiscal já usa para
 * espécie — cor de categoria, não de juízo.
 */
export const ESPECIES_PROD: ClasseInfo[] = [
  { id: "NFE", rotulo: "NF-e", descricao: "Nota fiscal eletrônica (modelo 55)", cor: "var(--esp-1)" },
  { id: "NFCE", rotulo: "NFC-e", descricao: "Consumidor final, varejo (modelo 65)", cor: "var(--esp-2)" },
  { id: "CTE", rotulo: "CT-e", descricao: "Conhecimento de transporte (modelo 57)", cor: "var(--esp-3)" },
  { id: "NFSE", rotulo: "NFS-e", descricao: "Serviço — conta decidida caso a caso", cor: "var(--esp-4)" },
  { id: "NF", rotulo: "NF", descricao: "Nota em papel / modelos antigos", cor: "var(--esp-5)" },
  { id: "OUTRAS", rotulo: "Outras", descricao: "Demais espécies do período", cor: "var(--esp-outras)" },
];

const IDS_ESPECIE = new Set(ESPECIES_PROD.map((e) => e.id));

/** Espécie do banco → id do catálogo. O que não está no catálogo vira "OUTRAS". */
export function classeDaEspecie(especie: string | null | undefined): string {
  const e = (especie ?? "").trim().toUpperCase();
  return IDS_ESPECIE.has(e) && e !== "OUTRAS" ? e : "OUTRAS";
}

/**
 * COMO a nota entrou, de `origemdado`. É o eixo da automação: separa o que
 * alguém digitou do que a integração trouxe. Nesta base a integração domina
 * (~98%), e é justamente por isso que o pouco que sobra — o digitado — é o que
 * merece nome próprio na tela.
 *
 * Os códigos não são documentados no banco; o significado foi inferido e está
 * registrado em [[Modelo de dados fiscais do Questor]].
 */
export const NATUREZAS: ClasseInfo[] = [
  { id: "1", rotulo: "Digitado", descricao: "Lançado a dedo no Fiscal", cor: "var(--esp-1)" },
  { id: "2", rotulo: "Importado", descricao: "Arquivo de importação", cor: "var(--esp-3)" },
  { id: "3", rotulo: "Integração", descricao: "e-Doc / captura automática", cor: "var(--esp-5)" },
  { id: "0", rotulo: "Sem origem", descricao: "Origem não informada na nota", cor: "var(--esp-outras)" },
];

export function rotuloNatureza(codigo: number | null | undefined): string {
  return NATUREZAS.find((n) => n.id === String(codigo ?? 0))?.rotulo ?? `Origem ${codigo}`;
}

/** Uma espécie no período, com quantas pessoas a escrituraram. */
export interface FisEspecieItem extends ProdItem {
  pessoas: number;
}

/**
 * Uma pessoa do Fiscal no período. Carrega os próprios recortes (espécies,
 * empresas, horas, dias) para a tela isolar alguém sem nova ida ao banco — são
 * poucos bytes por pessoa e evita refetch a cada clique.
 */
export interface FisPessoa {
  codigo: number;
  nome: string;
  /** Usuário com data de baixa no Questor (desligado). */
  inativo: boolean;
  notas: number;
  valor: number;
  entradas: number;
  saidas: number;
  /** Notas canceladas — trabalho FEITO, por isso contam no total. */
  canceladas: number;
  /** O que a pessoa digitou ou importou (o que não veio da integração). */
  aDedo: number;
  empresas: number;
  diasAtivos: number;
  /** Rodadas de trabalho: empresa × dia × espécie — o Questor não tem lote. */
  rodadas: number;
  ultimo: string | null;
  porClasse: PorClasseGen;
  especies: { chave: string; qtd: number }[];
  naturezas: { chave: string; qtd: number }[];
  topEmpresas: ProdItem[];
  porHora: number[];
  serie: ProdDia[];
}

export interface FisTotais {
  notas: number;
  valor: number;
  pessoas: number;
  empresas: number;
  rodadas: number;
  diasAtivos: number;
  entradas: number;
  saidas: number;
  canceladas: number;
  aDedo: number;
  porClasse: PorClasseGen;
}

export interface FiscalProdutividadeResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: FisTotais;
  /** Mesmo tamanho de período, imediatamente antes — para o delta dos KPIs. */
  anterior: { notas: number; valor: number };
  ranking: FisPessoa[];
  especies: FisEspecieItem[];
  naturezas: ProdItem[];
  empresas: ProdItem[];
  porHora: number[];
  serie: SeriePontoGen[];
  calendario: ProdCalendario;
}
