import { PoolClient } from "pg";
import type { ComponentePlano, LinhaPlano, PlanoCfop } from "./types";

/**
 * Um "componente" é cada slot de contabilização que o Questor configura no CFOP:
 * o valor contábil (mercadoria) e um por tributo. Cada slot aponta para uma
 * tabela de contabilização (tabelactbfis), que por sua vez gera os lançamentos.
 *
 * `apura` é o flag do próprio CFOP que liga o tributo — quando está desligado,
 * o Questor não gera aquele lançamento e cobrar isso seria falso positivo.
 */
interface ComponenteDef {
  id: string;
  rotulo: string;
  coluna: string;
  apura?: string;
  /** Tributo retido: sai do valor a pagar e vira obrigação, não crédito. */
  retido?: boolean;
}

export const COMPONENTES: ComponenteDef[] = [
  { id: "vlrcontabil", rotulo: "Valor contábil", coluna: "codigotabctbfisvlrcontabil" },
  { id: "icms", rotulo: "ICMS", coluna: "codigotabctbfisicms", apura: "apuraicms" },
  { id: "ipi", rotulo: "IPI", coluna: "codigotabctbfisipi", apura: "apuraipi" },
  { id: "iss", rotulo: "ISS", coluna: "codigotabctbfisiss", apura: "apuraiss" },
  { id: "pis", rotulo: "PIS", coluna: "codigotabctbfispis", apura: "apurapiscofinsoutros" },
  { id: "cofins", rotulo: "COFINS", coluna: "codigotabctbfiscofins", apura: "apurapiscofinsoutros" },
  { id: "st", rotulo: "ICMS ST", coluna: "codigotabctbfissubtribut", apura: "apurasubtribut" },
  { id: "funrural", rotulo: "Funrural", coluna: "codigotabctbfisfunrural", apura: "apurafunrural" },
  { id: "difalfcp", rotulo: "DIFAL/FCP", coluna: "codigotabctbfisdifalfcp" },
  { id: "monofasico", rotulo: "ICMS monofásico", coluna: "codigotabctbfismonofasico", apura: "apuraicmsmonofasico" },
  { id: "credpressn", rotulo: "Crédito presumido SN", coluna: "codigotabctbfiscredpressn", apura: "apuracreditopresumidosn" },
  { id: "irrfret", rotulo: "IRRF retido", coluna: "codigotabctbfisirrfret", apura: "apurairrfret", retido: true },
  { id: "irpjret", rotulo: "IRPJ retido", coluna: "codigotabctbfisirpjret", apura: "apurairpjret", retido: true },
  { id: "inssret", rotulo: "INSS retido", coluna: "codigotabctbfisinssret", apura: "apurainssret", retido: true },
  { id: "issqnret", rotulo: "ISSQN retido", coluna: "codigotabctbfisissqnret", apura: "apuraissqnret", retido: true },
  { id: "pisret", rotulo: "PIS retido", coluna: "codigotabctbfispisret", apura: "apurapiscofinscsllret", retido: true },
  { id: "cofinsret", rotulo: "COFINS retido", coluna: "codigotabctbfiscofinsret", apura: "apurapiscofinscsllret", retido: true },
  { id: "csllret", rotulo: "CSLL retido", coluna: "codigotabctbfiscsllret", apura: "apurapiscofinscsllret", retido: true },
];

/** Entrada (CFOP 1/2/3xxx) debita estoque/despesa; saída (5/6/7xxx) credita receita. */
export function ladoDoCfop(codigocfop: number): "ent" | "sai" {
  const primeiro = Number(String(codigocfop)[0]);
  return primeiro <= 3 ? "ent" : "sai";
}

/** CFOP "de verdade" (4 dígitos) — o Questor guarda um código interno maior. */
export function cfopBase(codigocfop: number): number {
  return Number(String(codigocfop).slice(0, 4));
}

const COLUNAS = COMPONENTES.map((c) => c.coluna).join(", ");
const APURAS = [...new Set(COMPONENTES.map((c) => c.apura).filter(Boolean))].join(", ");

interface CfopRow extends Record<string, unknown> {
  codigoestab: number;
  codigocfop: number;
  descrcfop: string | null;
  contactblivro: number | null;
}

interface LinhaRow {
  codigotabctbfis: number;
  descrtabctbfis: string | null;
  seq: number;
  origemcontactb: number;
  naturlctoctb: number;
  contactb: number | null;
  regravalorlctoctb: string | null;
  codigohistctb: number | null;
}

/**
 * Lê do Questor o plano de contabilização de uma empresa: para cada CFOP
 * cadastrado, quais lançamentos (conta + natureza + regra de valor) o ERP
 * espera gerar. É o padrão que a tela de Configuração mostra e que a
 * Conferência usa quando não há override.
 */
export async function planoQuestor(
  client: PoolClient,
  empresa: number,
  opts: { estab?: number; cfops?: number[] } = {}
): Promise<PlanoCfop[]> {
  const params: unknown[] = [empresa];
  let filtro = "";
  if (opts.estab != null) {
    params.push(opts.estab);
    filtro += ` and codigoestab = $${params.length}`;
  }
  if (opts.cfops?.length) {
    params.push(opts.cfops);
    filtro += ` and codigocfop = any($${params.length}::int[])`;
  }

  const cfops = await client.query<CfopRow>(
    `select codigoestab, codigocfop, descrcfop, contactblivro, ${COLUNAS}, ${APURAS}
       from cfop where codigoempresa = $1${filtro}
      order by codigocfop, codigoestab`,
    params
  );
  if (!cfops.rows.length) return [];

  // Uma tabela é reusada por muitos CFOPs — busca todas de uma vez e indexa.
  const tabelas = new Set<number>();
  for (const row of cfops.rows) {
    for (const c of COMPONENTES) {
      const t = row[c.coluna] as number | null;
      if (t != null) tabelas.add(t);
    }
  }
  if (!tabelas.size) return [];

  const linhas = await client.query<LinhaRow>(
    `select l.codigotabctbfis, t.descrtabctbfis, l.seq, l.origemcontactb,
            l.naturlctoctb, l.contactb, l.regravalorlctoctb, l.codigohistctb
       from tabelactbfislctoctb l
       join tabelactbfis t
         on t.codigoempresa = l.codigoempresa and t.codigotabctbfis = l.codigotabctbfis
      where l.codigoempresa = $1 and l.codigotabctbfis = any($2::int[])
      order by l.codigotabctbfis, l.seq`,
    [empresa, [...tabelas]]
  );

  const porTabela = new Map<number, LinhaRow[]>();
  for (const l of linhas.rows) {
    const lista = porTabela.get(l.codigotabctbfis);
    if (lista) lista.push(l);
    else porTabela.set(l.codigotabctbfis, [l]);
  }

  // Descrição das contas fixas, para a tela mostrar nome e não só número.
  const contas = new Set<number>();
  for (const l of linhas.rows) if (l.contactb != null) contas.add(l.contactb);
  const nomes = await nomesDeContas(client, empresa, [...contas]);

  return cfops.rows.map((row) => {
    const componentes: ComponentePlano[] = [];
    for (const c of COMPONENTES) {
      const tabela = row[c.coluna] as number | null;
      if (tabela == null) continue;
      // apura desligado = o Questor não gera esse lançamento, mesmo com tabela
      if (c.apura && row[c.apura] !== "1") continue;
      const linhasTab = porTabela.get(tabela) ?? [];
      componentes.push({
        id: c.id,
        rotulo: c.rotulo,
        retido: c.retido ?? false,
        tabela,
        descrTabela: linhasTab[0]?.descrtabctbfis ?? null,
        linhas: linhasTab.map((l) => montarLinha(l, nomes)),
      });
    }
    return {
      estab: row.codigoestab,
      cfop: row.codigocfop,
      cfopBase: cfopBase(row.codigocfop),
      descricao: row.descrcfop,
      lado: ladoDoCfop(row.codigocfop),
      contaLivro: row.contactblivro,
      componentes,
      origem: "questor" as const,
      contabiliza: componentes.length > 0,
    };
  });
}

function montarLinha(l: LinhaRow, nomes: Map<number, string>): LinhaPlano {
  return {
    seq: l.seq,
    natureza: l.naturlctoctb >= 0 ? 1 : -1,
    conta: l.contactb,
    // origem 1 e 2 = conta variável (vem do fornecedor/cliente na hora do lançamento)
    contaVariavel: l.origemcontactb !== 0,
    origemConta: l.origemcontactb,
    descrConta: l.contactb != null ? (nomes.get(l.contactb) ?? null) : null,
    regraValor: l.regravalorlctoctb,
    historico: l.codigohistctb,
  };
}

/**
 * Contas analíticas por trás de uma linha do balancete, para o drill-down.
 * Linha SINTÉTICA soma a subárvore (classif e descendentes); linha ANALÍTICA é a
 * própria conta — e só ela, porque no Questor várias contas distintas (cada
 * cliente/fornecedor) dividem a MESMA `classifconta`, então escopar por classif
 * somaria todas as irmãs.
 */
export async function contasDoAlvo(
  client: PoolClient,
  empresa: number,
  classif: string,
  sintetica: boolean,
  conta: number
): Promise<number[]> {
  if (!sintetica) return Number.isInteger(conta) && conta > 0 ? [conta] : [];
  const { rows } = await client.query<{ conta: number }>(
    `select contactb conta from planoespec
      where codigoempresa=$1 and tipoconta=2
        and (classifconta = $2 or classifconta like $2 || '.%')`,
    [empresa, classif]
  );
  return rows.map((r) => r.conta);
}

export async function nomesDeContas(
  client: PoolClient,
  empresa: number,
  contas: number[]
): Promise<Map<number, string>> {
  if (!contas.length) return new Map();
  const { rows } = await client.query<{ contactb: number; descrconta: string }>(
    `select contactb, descrconta from planoespec
      where codigoempresa = $1 and contactb = any($2::bigint[])`,
    [empresa, contas]
  );
  return new Map(rows.map((r) => [r.contactb, r.descrconta]));
}
