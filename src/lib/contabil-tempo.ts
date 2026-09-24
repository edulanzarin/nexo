import "server-only";
import { query } from "./db";
import {
  bucketDe,
  buckets,
  carregarCadastros,
  condEscopo,
  granularidadeDe,
  type ProdFiltros,
} from "./contabil-prod-comum";
import type { CtbItem } from "./contabil-produtividade-tipos";
import type {
  ContabilTempoResp,
  CtbTempoEmpresa,
  CtbTempoPessoa,
} from "./contabil-tempo-tipos";

/**
 * ABA TEMPO — horas dentro do Questor, por pessoa e por empresa.
 *
 * Duas varreduras em paralelo: o `tempouso` do período (tabela pequena, ~700 mil
 * linhas no total, ~30 mil por mês) e o grão (usuário, empresa) do `lctoctb`, que
 * dá o outro lado da conta — os lançamentos que aquelas horas produziram.
 *
 * Só entra no ranking quem lançou algo no contábil no período: o `tempouso` mede
 * o Questor inteiro, e sem esse corte a tela mostraria o time da folha dentro da
 * Produtividade do Contábil. O que sobra é somado em `foraDoContabil` — o
 * recorte aparece na tela, não desaparece.
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

interface LctoRow {
  u: number;
  e: number;
  n: number;
}

const horas = (segundos: number) => segundos / HORA;

export async function montarTempoContabil(f: ProdFiltros): Promise<ContabilTempoResp> {
  // `datauso` é DATE: `between` já cobre o dia inteiro. Filial não entra — o
  // `tempouso` não tem `codigoestab`.
  const paramsTempo: unknown[] = [f.inicio, f.fim];
  const condsTempo = [`datauso between $1::date and $2::date`];
  condsTempo.push(...(await condEscopo(f, paramsTempo, { filial: false })));

  const paramsLcto: unknown[] = [f.inicio, f.fim];
  const condsLcto = [`datahoralctoctb >= $1::date and datahoralctoctb < ($2::date + 1)`];
  condsLcto.push(...(await condEscopo(f, paramsLcto)));

  const [tempo, lctos] = await Promise.all([
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
    query<LctoRow>(
      `select codigousuario as u, codigoempresa as e, count(*)::int as n
         from lctoctb
        where ${condsLcto.join(" and ")}
        group by 1, 2`,
      paramsLcto
    ),
  ]);

  // ── Lançamentos por pessoa e por empresa (o corte do "time do contábil") ──
  const lctoPessoa = new Map<number, number>();
  const lctoEmpresa = new Map<number, number>();
  let lancamentos = 0;
  for (const r of lctos) {
    lctoPessoa.set(r.u, (lctoPessoa.get(r.u) ?? 0) + r.n);
    lctoEmpresa.set(r.e, (lctoEmpresa.get(r.e) ?? 0) + r.n);
    lancamentos += r.n;
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
    if (!lctoPessoa.has(r.u)) {
      segFora += r.seg;
      foraPessoas.add(r.u);
      continue;
    }
    segTotal += r.seg;
    dias.add(r.d);
    porDia.set(r.d, (porDia.get(r.d) ?? 0) + r.seg);
    porDiaSemana[new Date(r.d + "T00:00:00Z").getUTCDay()] += r.seg;

    const p = pessoas.get(r.u) ?? { seg: 0, dias: new Set<string>(), empresas: new Map<number, number>() };
    p.seg += r.seg;
    p.dias.add(r.d);
    p.empresas.set(r.e, (p.empresas.get(r.e) ?? 0) + r.seg);
    pessoas.set(r.u, p);

    const em = empresas.get(r.e) ?? { seg: 0, pessoas: new Set<number>() };
    em.seg += r.seg;
    em.pessoas.add(r.u);
    empresas.set(r.e, em);
  }

  const cadastros = await carregarCadastros({ empresas: [...empresas.keys()] });

  const ranking: CtbTempoPessoa[] = [...pessoas.entries()]
    .map(([codigo, p]) => {
      const h = horas(p.seg);
      const n = lctoPessoa.get(codigo) ?? 0;
      const topEmpresas: CtbItem[] = [...p.empresas.entries()]
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
        lancamentos: n,
        porHora: h > 0 ? n / h : 0,
        topEmpresas,
      } satisfies CtbTempoPessoa;
    })
    .sort((a, b) => b.horas - a.horas);

  const listaEmpresas: CtbTempoEmpresa[] = [...empresas.entries()]
    .map(([codigo, e]) => {
      const h = horas(e.seg);
      const n = lctoEmpresa.get(codigo) ?? 0;
      return {
        chave: String(codigo),
        nome: cadastros.nomeEmpresa(codigo),
        horas: h,
        pessoas: e.pessoas.size,
        lancamentos: n,
        minutosPorLancamento: n > 0 ? (h * 60) / n : null,
      } satisfies CtbTempoEmpresa;
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
      lancamentos,
      lancamentosPorHora: horasTotal > 0 ? lancamentos / horasTotal : 0,
    },
    foraDoContabil: { pessoas: foraPessoas.size, horas: horas(segFora) },
    ranking,
    empresas: listaEmpresas,
    serie: [...serieMapa.entries()].map(([bucket, seg]) => ({ bucket, horas: horas(seg) })),
    porDiaSemana: porDiaSemana.map(horas),
  };
}
