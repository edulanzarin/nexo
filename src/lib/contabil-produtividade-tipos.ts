/**
 * Tipos e catálogo da PRODUTIVIDADE DO CONTÁBIL — "quem lançou o quê" no
 * `lctoctb`, no período. Fica fora do `contabil-produtividade.ts` (server-only)
 * porque a interface também precisa do catálogo de classes e das cores.
 *
 * O recorte é por `datahoralctoctb` (quando o lançamento foi FEITO), nunca por
 * `datalctoctb` (a data do fato) — é produtividade, mede o trabalho do período.
 * Mesma doutrina da Produtividade do DP. Ver [[Logs e auditoria no Questor]].
 */

/**
 * Natureza do lançamento, derivada de `codigooriglctoctb`. É o eixo que separa
 * o que foi DIGITADO do que veio de rotina — sem ele, um mês de integração
 * fiscal esconde o trabalho a dedo da contabilidade.
 */
export type ClasseOrigem = "digitado" | "importado" | "integrado" | "apuracao" | "outros";

/**
 * Cores da paleta CATEGÓRICA (`--esp-*`), não as semânticas: classe de origem é
 * categoria, não juízo — e `--ent`/`--accent` são quase o mesmo azul, o que
 * embaralhava "Digitado" com "Integrado" no gráfico.
 */
export const CLASSES: { id: ClasseOrigem; rotulo: string; descricao: string; cor: string }[] = [
  {
    id: "digitado",
    rotulo: "Digitado",
    descricao: "Lançado a dedo na Contabilidade (CB)",
    cor: "var(--esp-1)",
  },
  {
    id: "importado",
    rotulo: "Importado",
    descricao: "Arquivo de importação e conciliação (IP, CC)",
    cor: "var(--esp-3)",
  },
  {
    id: "integrado",
    rotulo: "Integrado",
    descricao: "Veio de outro módulo do Questor (FI, FP, CP, CR, FN, IM…)",
    cor: "var(--esp-5)",
  },
  {
    id: "apuracao",
    rotulo: "Apuração e ajuste",
    descricao: "Zeramento, extemporâneo, Lalur, saldo inicial (ZZ, XX, AA, LA…)",
    cor: "var(--esp-2)",
  },
  { id: "outros", rotulo: "Outras origens", descricao: "Origem sem classificação", cor: "var(--esp-outras)" },
];

/**
 * `codigooriglctoctb` → classe. A tabela `origemlctoctb` dá o RÓTULO (lido do
 * banco, para não envelhecer aqui); a CLASSE é juízo nosso e mora no código.
 * Origem que não estiver no mapa cai em "outros" — e aparece assim mesmo na
 * tela, com o nome vindo do banco.
 */
export const CLASSE_POR_ORIGEM: Record<string, ClasseOrigem> = {
  CB: "digitado",
  "01": "digitado", // "Usuário"
  "02": "digitado", // "Lançamentos de caixa"
  IP: "importado",
  CC: "importado",
  FI: "integrado",
  FP: "integrado",
  CP: "integrado",
  CR: "integrado",
  FN: "integrado",
  IM: "integrado",
  CT: "integrado",
  CE: "integrado",
  AD: "integrado",
  ZZ: "apuracao",
  AA: "apuracao",
  XX: "apuracao",
  LA: "apuracao",
  EF: "apuracao",
  AI: "apuracao",
  IS: "apuracao",
  IF: "apuracao",
  TF: "apuracao",
  TR: "apuracao",
  TS: "apuracao",
};

export function classeDaOrigem(codigo: string | null | undefined): ClasseOrigem {
  if (!codigo) return "outros";
  return CLASSE_POR_ORIGEM[codigo.trim().toUpperCase()] ?? "outros";
}

export type PorClasse = Record<ClasseOrigem, number>;

export const zeroClasses = (): PorClasse => ({
  digitado: 0,
  importado: 0,
  integrado: 0,
  apuracao: 0,
  outros: 0,
});

/** Um item de ranking (empresa, origem…) — quantidade e valor movimentado. */
export interface CtbItem {
  chave: string;
  nome: string;
  qtd: number;
  valor: number;
}

/** Uma origem no período, já com a classe e quantas pessoas a usaram. */
export interface CtbOrigemItem extends CtbItem {
  classe: ClasseOrigem;
  pessoas: number;
}

/** Um dia com movimento de uma pessoa (série esparsa: só dia que teve trabalho). */
export interface CtbDia {
  d: string;
  n: number;
}

/**
 * Uma pessoa do Contábil no período. Carrega os próprios recortes (origens,
 * empresas, horas, dias) para a tela isolar alguém sem nova ida ao banco — são
 * poucos bytes por pessoa e evita refetch a cada clique.
 */
export interface CtbPessoa {
  codigo: number;
  nome: string;
  /** Usuário com data de baixa no Questor (desligado). */
  inativo: boolean;
  lancamentos: number;
  valor: number;
  /** Empresas distintas atendidas. */
  empresas: number;
  /** Dias em que lançou alguma coisa. */
  diasAtivos: number;
  /** Rodadas de trabalho: empresa × dia × origem (o `codigolotectb` do Questor
   *  vem sempre zerado, então a rodada é reconstruída pelo grão). */
  rodadas: number;
  /** Último dia com lançamento (YYYY-MM-DD). */
  ultimo: string | null;
  porClasse: PorClasse;
  origens: { chave: string; qtd: number }[];
  topEmpresas: CtbItem[];
  /** 24 posições: lançamentos por hora do dia. */
  porHora: number[];
  serie: CtbDia[];
}

/** Um ponto da série do time, já quebrado por classe. */
export interface CtbSeriePonto extends PorClasse {
  bucket: string;
  total: number;
}

export interface CtbTotais {
  lancamentos: number;
  valor: number;
  /** Pessoas que lançaram alguma coisa. */
  pessoas: number;
  empresas: number;
  rodadas: number;
  diasAtivos: number;
  porClasse: PorClasse;
}

export interface ContabilProdutividadeResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: CtbTotais;
  /** Mesmo tamanho de período, imediatamente antes — para o delta dos KPIs. */
  anterior: { lancamentos: number; valor: number };
  ranking: CtbPessoa[];
  origens: CtbOrigemItem[];
  /** Top empresas do time no período. */
  empresas: CtbItem[];
  /** 24 posições: quando o time trabalha. */
  porHora: number[];
  serie: CtbSeriePonto[];
  /** Grade diária (estilo GitHub) do time — mesma forma do calendário do Fiscal. */
  calendario: { inicio: string; fim: string; celulas: CtbDia[]; total: number; pico: CtbDia | null };
}
