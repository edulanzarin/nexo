import "server-only";
import { query } from "./db";
import { carregarCadastrosFiscal, whereTrabalho } from "./fiscal-prod-comum";
import { bucketDe, buckets, condEscopo, granularidadeDe, type ProdFiltros } from "./prod-comum";
import type { ProdItem } from "./prod-tipos";
import type { FisTempoEmpresa, FisTempoPessoa, FiscalTempoResp } from "./fiscal-tempo-tipos";

/**
 * ABA TEMPO — horas dentro do Questor, por pessoa e por empresa do time fiscal.
 *
 * Duas varreduras em paralelo: o `tempouso` do período (tabela pequena, ~30 mil
 * linhas por mês) e o grão (usuário, empresa) das notas, que dá o outro lado da
 * conta — o que aquelas horas produziram.
 *
 * Só entra no ranking quem escriturou nota no período: o `tempouso` mede o
 * Questor inteiro, e sem esse corte a tela mostraria o time da folha dentro da
 * Produtividade do Fiscal. O que sobra é somado em `foraDoFiscal` — o recorte
 * aparece na tela, não desaparece.
 */

const TOP_EMPRESAS = 200;
const TOP_EMPRESAS_PESSOA = 25;
const HORA = 3600;

interface TempoRow {
  u: number;
  e: number;
  d: string;
  seg: number;
}

interface NotaRow {
  u: number;
  e: number;
  n: number;
  dedo: number;
}

const horas = (segundos: number) => segundos / HORA;

export async function montarTempoFiscal(f: ProdFiltros): Promise<FiscalTempoResp> {
  // `datauso` é DATE: `between` já cobre o dia inteiro. Filial não entra — o
  // `tempouso` não tem `codigoestab`.
  const paramsTempo: unknown[] = [f.inicio, f.fim];
  const condsTempo = [`datauso between $1::date and $2::date`];
  condsTempo.push(...(await condEscopo(f, paramsTempo, { filial: false })));

  const w = await whereTrabalho(f);
  const selecao = (tabela: string) =>
    `select codigousuario, codigoempresa, origemdado from ${tabela} where ${w.sql}`;

  const [tempo, notasPorEmpresa] = await Promise.all([
    query<TempoRow>(
      `select codigousuario as u,
              codigoempresa as e,
              to_char(datauso, 'YYYY-MM-DD') as d,
              coalesce(sum(tempouso), 0)::float as seg
         from tempouso
        where ${condsTempo.join(" and ")}
        group by 1, 2, 3`,
      paramsTempo
    ),
    query<NotaRow>(
      `with mov as (
         ${selecao("lctofisent")}
         union all
         ${selecao("lctofissai")}
       )
       select codigousuario as u, codigoempresa as e,
              count(*)::int as n,
              count(*) filter (where origemdado is distinct from 3)::int as dedo
         from mov
        group by 1, 2`,
      w.params
    ),
  ]);

  // ── Notas por pessoa e por empresa (o corte do "time do fiscal") ──────────
  const notaPessoa = new Map<number, { n: number; dedo: number }>();
  const notaEmpresa = new Map<number, number>();
  let notas = 0;
  let aDedo = 0;
  for (const r of notasPorEmpresa) {
    const p = notaPessoa.get(r.u) ?? { n: 0, dedo: 0 };
    p.n += r.n;
    p.dedo += r.dedo;
    notaPessoa.set(r.u, p);
    notaEmpresa.set(r.e, (notaEmpresa.get(r.e) ?? 0) + r.n);
    notas += r.n;
    aDedo += r.dedo;
  }

  interface Acc {
    seg: number;
    dias: Set<string>;
    empresas: Map<number, number>;
  }
  const pessoas = new Map<number, Acc>();
  const empresas = new Map<number, { seg: number; pessoas: Set<number> }>();
  const porDia = new Map<string, number>();
  const porDiaSemana = Array.from({ length: 7 }, () => 0);
  const dias = new Set<string>();
  let segTotal = 0;
  let segFora = 0;
  const foraPessoas = new Set<number>();

  for (const r of tempo) {
    if (!notaPessoa.has(r.u)) {
      segFora += r.seg;
      foraPessoas.add(r.u);
      continue;
    }
    segTotal += r.seg;
    dias.add(r.d);
    porDia.set(r.d, (porDia.get(r.d) ?? 0) + r.seg);
    porDiaSemana[new Date(r.d + "T00:00:00Z").getUTCDay()] += r.seg;

    const p =
      pessoas.get(r.u) ?? { seg: 0, dias: new Set<string>(), empresas: new Map<number, number>() };
    p.seg += r.seg;
    p.dias.add(r.d);
    p.empresas.set(r.e, (p.empresas.get(r.e) ?? 0) + r.seg);
    pessoas.set(r.u, p);

    const em = empresas.get(r.e) ?? { seg: 0, pessoas: new Set<number>() };
    em.seg += r.seg;
    em.pessoas.add(r.u);
    empresas.set(r.e, em);
  }

  const cadastros = await carregarCadastrosFiscal([...empresas.keys()]);

  const ranking: FisTempoPessoa[] = [...pessoas.entries()]
    .map(([codigo, p]) => {
      const h = horas(p.seg);
      const n = notaPessoa.get(codigo) ?? { n: 0, dedo: 0 };
      const topEmpresas: ProdItem[] = [...p.empresas.entries()]
        .map(([e, seg]) => ({
          chave: String(e),
          nome: cadastros.nomeEmpresa(e),
          // O "valor" do item aqui é a hora: o gráfico de barras é o mesmo, e a
          // quantidade continua sendo o que a barra mede.
          qtd: Math.round(horas(seg) * 10) / 10,
          valor: 0,
        }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, TOP_EMPRESAS_PESSOA);
      return {
        codigo,
        nome: cadastros.nomeUsuario(codigo),
        inativo: cadastros.usuarioInativo(codigo),
        horas: h,
        dias: p.dias.size,
        empresas: p.empresas.size,
        horasPorDia: p.dias.size > 0 ? h / p.dias.size : 0,
        notas: n.n,
        aDedo: n.dedo,
        porHora: h > 0 ? n.n / h : 0,
        topEmpresas,
      } satisfies FisTempoPessoa;
    })
    .sort((a, b) => b.horas - a.horas);

  const listaEmpresas: FisTempoEmpresa[] = [...empresas.entries()]
    .map(([codigo, e]) => {
      const h = horas(e.seg);
      const n = notaEmpresa.get(codigo) ?? 0;
      return {
        chave: String(codigo),
        nome: cadastros.nomeEmpresa(codigo),
        horas: h,
        pessoas: e.pessoas.size,
        notas: n,
        minutosPorNota: n > 0 ? (h * 60) / n : null,
      } satisfies FisTempoEmpresa;
    })
    .sort((a, b) => b.horas - a.horas)
    .slice(0, TOP_EMPRESAS);

  const granularidade = granularidadeDe(f.inicio, f.fim);
  const serieMapa = new Map<string, number>();
  for (const b of buckets(f.inicio, f.fim, granularidade)) serieMapa.set(b, 0);
  for (const [d, seg] of porDia) {
    const b = bucketDe(d, granularidade);
    if (serieMapa.has(b)) serieMapa.set(b, (serieMapa.get(b) ?? 0) + seg);
  }

  const horasTotal = horas(segTotal);
  return {
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      horas: horasTotal,
      pessoas: pessoas.size,
      empresas: empresas.size,
      dias: dias.size,
      horasPorPessoaDia:
        pessoas.size > 0
          ? horasTotal / [...pessoas.values()].reduce((a, p) => a + p.dias.size, 0)
          : 0,
      horasPorEmpresa: empresas.size > 0 ? horasTotal / empresas.size : 0,
      notas,
      aDedo,
      notasPorHora: horasTotal > 0 ? notas / horasTotal : 0,
      aDedoPorHora: horasTotal > 0 ? aDedo / horasTotal : 0,
    },
    foraDoFiscal: { pessoas: foraPessoas.size, horas: horas(segFora) },
    ranking,
    empresas: listaEmpresas,
    serie: [...serieMapa.entries()].map(([bucket, seg]) => ({ bucket, horas: horas(seg) })),
    porDiaSemana: porDiaSemana.map(horas),
  };
}
