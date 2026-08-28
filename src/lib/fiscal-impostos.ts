import "server-only";
import { query } from "./db";
import { carregarCadastrosFiscal, whereTrabalho } from "./fiscal-prod-comum";
import { bucketDe, buckets, granularidadeDe, type ProdFiltros } from "./prod-comum";
import type { ProdItem } from "./prod-tipos";
import {
  TRIBUTOS,
  zeroTributos,
  type FisImpEmpresa,
  type FisImpPessoa,
  type FisTributoItem,
  type FiscalImpostosResp,
  type PorTributo,
} from "./fiscal-impostos-tipos";

/**
 * ABA IMPOSTOS — quanto de tributo cada pessoa escriturou no período.
 *
 * A forma da consulta é sempre a mesma e muda só a tabela de detalhe: recorta o
 * CABEÇALHO pelo carimbo de digitação (que é o que define "trabalho do
 * período"), junta a filha pela chave da nota e soma. A junção é por índice
 * (`(codigoempresa, chavelctofis*)` existe em todas as filhas), então o custo é
 * o da varredura do cabeçalho — que a aba Lançamentos já paga.
 *
 * Sete varreduras em PARALELO: item, PIS/COFINS e retenção nos dois lados, mais
 * o DIFAL nas saídas. Em série isso seria a soma dos tempos; em paralelo é o
 * tempo da mais lenta (o item das saídas, ~8 s no mês do escritório inteiro).
 *
 * O grão é (usuário, empresa, dia) — o suficiente para ranking, empresas e
 * série, e pequeno o bastante para caber na memória: ~300 linhas por varredura
 * num mês, porque o fiscal escritura em lote.
 */

interface TribRow {
  u: number;
  e: number;
  d: string;
  [tributo: string]: number | string;
}

/** Colunas somadas em cada tabela de detalhe, já com o nome do tributo. */
const FONTES: {
  id: string;
  tabela: (lado: "ent" | "sai") => string;
  chave: (lado: "ent" | "sai") => string;
  colunas: Record<string, string>;
  lados: ("ent" | "sai")[];
}[] = [
  {
    id: "produto",
    tabela: (l) => `lctofis${l}produto`,
    chave: (l) => `chavelctofis${l}`,
    colunas: { icms: "x.valoricms", ipi: "x.valoripi", st: "x.valorsubtribut", iss: "x.valoriss" },
    lados: ["ent", "sai"],
  },
  {
    id: "piscofins",
    tabela: (l) => `lctofis${l}piscofins`,
    chave: (l) => `chavelctofis${l}`,
    colunas: { pis: "x.valorpis", cofins: "x.valorcofins" },
    lados: ["ent", "sai"],
  },
  {
    id: "retido",
    tabela: (l) => `lctofis${l}retido`,
    chave: (l) => `chavelctofis${l}`,
    // As quatro retenções entram somadas numa linha só: separá-las encheria a
    // tela de colunas quase sempre zeradas (NFS-e é uma fatia pequena do volume).
    colunas: {
      retido:
        "coalesce(x.valorirrf,0) + coalesce(x.valorinss,0) + coalesce(x.valorcsll,0) + coalesce(x.valorissqn,0)",
    },
    lados: ["ent", "sai"],
  },
  {
    id: "difal",
    tabela: () => `lctofissaidifal`,
    chave: () => `chavelctofissai`,
    colunas: { difal: "coalesce(x.vlricmsintufdest,0) + coalesce(x.vlricmsfcpufdest,0)" },
    lados: ["sai"],
  },
];

const TOP_EMPRESAS = 200;
const TOP_EMPRESAS_PESSOA = 15;

interface Acc {
  codigo: number;
  notas: number;
  entradas: number;
  saidas: number;
  porTributo: PorTributo;
  empresas: Map<number, number>;
}

export async function montarImpostosFiscal(f: ProdFiltros): Promise<FiscalImpostosResp> {
  const w = await whereTrabalho(f, { alias: "n" });

  /** Soma uma tabela de detalhe, recortada pelo cabeçalho do período. */
  const varrer = (fonte: (typeof FONTES)[number], lado: "ent" | "sai") => {
    // As colunas já vêm qualificadas com o alias da tabela de detalhe: sem isso,
    // o dia em que o cabeçalho ganhar uma coluna de mesmo nome a soma muda de
    // tabela em silêncio.
    const somas = Object.entries(fonte.colunas)
      .map(([id, col]) => `coalesce(sum(${col}), 0)::float as ${id}`)
      .join(",\n              ");
    return query<TribRow>(
      `select n.codigousuario as u, n.codigoempresa as e,
              to_char(n.datahoralctofis, 'YYYY-MM-DD') as d,
              ${somas}
         from lctofis${lado} n
         join ${fonte.tabela(lado)} x
           on x.codigoempresa = n.codigoempresa
          and x.${fonte.chave(lado)} = n.${fonte.chave(lado)}
        where ${w.sql}
        group by 1, 2, 3`,
      w.params
    ).then((rows) => ({ lado, rows }));
  };

  // Notas e valor de base vêm da mesma varredura de cabeçalho das outras abas —
  // sem elas o "tributo por nota" não teria denominador.
  const base = query<{ u: number; e: number; d: string; n: number; v: number }>(
    `select n.codigousuario as u, n.codigoempresa as e,
            to_char(n.datahoralctofis, 'YYYY-MM-DD') as d,
            count(*)::int as n, coalesce(sum(n.valorcontabil), 0)::float as v
       from (
         select codigousuario, codigoempresa, datahoralctofis, valorcontabil, especienf, codigoestab
           from lctofisent
         union all
         select codigousuario, codigoempresa, datahoralctofis, valorcontabil, especienf, codigoestab
           from lctofissai
       ) n
      where ${w.sql}
      group by 1, 2, 3`,
    w.params
  );

  const tarefas = FONTES.flatMap((fonte) => fonte.lados.map((lado) => varrer(fonte, lado)));
  const [linhasBase, ...detalhes] = await Promise.all([base, ...tarefas]);

  // ── Rollup ────────────────────────────────────────────────────────────────
  const pessoas = new Map<number, Acc>();
  const empresas = new Map<number, { total: number; porTributo: PorTributo; pessoas: Set<number>; notas: number; valor: number }>();
  const porDia = new Map<string, PorTributo>();
  const porTributoLado = new Map<string, { ent: number; sai: number }>();
  for (const t of TRIBUTOS) porTributoLado.set(t.id, { ent: 0, sai: 0 });
  let notas = 0;
  let valorBase = 0;

  const acc = (u: number): Acc => {
    let a = pessoas.get(u);
    if (!a) {
      a = { codigo: u, notas: 0, entradas: 0, saidas: 0, porTributo: zeroTributos(), empresas: new Map() };
      pessoas.set(u, a);
    }
    return a;
  };
  const daEmpresa = (e: number) => {
    let x = empresas.get(e);
    if (!x) {
      x = { total: 0, porTributo: zeroTributos(), pessoas: new Set(), notas: 0, valor: 0 };
      empresas.set(e, x);
    }
    return x;
  };

  for (const r of linhasBase) {
    notas += r.n;
    valorBase += r.v;
    const a = acc(r.u);
    a.notas += r.n;
    const emp = daEmpresa(r.e);
    emp.notas += r.n;
    emp.valor += r.v;
    emp.pessoas.add(r.u);
    a.empresas.set(r.e, a.empresas.get(r.e) ?? 0);
  }

  for (const { lado, rows } of detalhes) {
    for (const r of rows) {
      const a = acc(r.u);
      const emp = daEmpresa(r.e);
      const dia = porDia.get(r.d) ?? zeroTributos();
      for (const t of TRIBUTOS) {
        const v = typeof r[t.id] === "number" ? (r[t.id] as number) : 0;
        if (v === 0) continue;
        a.porTributo[t.id] += v;
        if (lado === "ent") a.entradas += v;
        else a.saidas += v;
        emp.porTributo[t.id] += v;
        emp.total += v;
        a.empresas.set(r.e, (a.empresas.get(r.e) ?? 0) + v);
        dia[t.id] += v;
        const lados = porTributoLado.get(t.id)!;
        lados[lado] += v;
      }
      porDia.set(r.d, dia);
    }
  }

  // ── Nomes e listas ────────────────────────────────────────────────────────
  const cadastros = await carregarCadastrosFiscal([...empresas.keys()]);
  const somaTributos = (m: PorTributo) => Object.values(m).reduce((a, b) => a + b, 0);

  const ranking: FisImpPessoa[] = [...pessoas.values()]
    .map((p) => {
      const total = somaTributos(p.porTributo);
      const topEmpresas: ProdItem[] = [...p.empresas.entries()]
        .map(([codigo, valor]) => ({
          chave: String(codigo),
          nome: cadastros.nomeEmpresa(codigo),
          qtd: 0,
          valor,
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, TOP_EMPRESAS_PESSOA);
      return {
        codigo: p.codigo,
        nome: cadastros.nomeUsuario(p.codigo),
        inativo: cadastros.usuarioInativo(p.codigo),
        notas: p.notas,
        total,
        entradas: p.entradas,
        saidas: p.saidas,
        empresas: p.empresas.size,
        porNota: p.notas > 0 ? total / p.notas : 0,
        porTributo: p.porTributo,
        topEmpresas,
      } satisfies FisImpPessoa;
    })
    .sort((a, b) => b.total - a.total);

  const listaEmpresas: FisImpEmpresa[] = [...empresas.entries()]
    .map(([codigo, e]) => ({
      chave: String(codigo),
      nome: cadastros.nomeEmpresa(codigo),
      qtd: e.notas,
      valor: e.total,
      pessoas: e.pessoas.size,
      porTributo: e.porTributo,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, TOP_EMPRESAS);

  const tributos: FisTributoItem[] = TRIBUTOS.map((t) => {
    const l = porTributoLado.get(t.id)!;
    return { id: t.id, rotulo: t.rotulo, cor: t.cor, entradas: l.ent, saidas: l.sai, total: l.ent + l.sai };
  }).filter((t) => t.total > 0);

  const granularidade = granularidadeDe(f.inicio, f.fim);
  const ordem = buckets(f.inicio, f.fim, granularidade);
  const acumulado = new Map<string, PorTributo>(ordem.map((b) => [b, zeroTributos()]));
  for (const [d, m] of porDia) {
    const alvo = acumulado.get(bucketDe(d, granularidade));
    if (!alvo) continue;
    for (const t of TRIBUTOS) alvo[t.id] += m[t.id];
  }
  const serie = ordem.map((b) => {
    const m = acumulado.get(b)!;
    return { bucket: b, total: somaTributos(m), ...m };
  });

  const totalGeral = tributos.reduce((a, t) => a + t.total, 0);
  return {
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      notas,
      valor: valorBase,
      total: totalGeral,
      entradas: tributos.reduce((a, t) => a + t.entradas, 0),
      saidas: tributos.reduce((a, t) => a + t.saidas, 0),
      pessoas: ranking.filter((p) => p.codigo !== 0).length,
      empresas: empresas.size,
    },
    tributos,
    ranking,
    empresas: listaEmpresas,
    serie,
  };
}
