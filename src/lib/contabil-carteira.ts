import "server-only";
import { query } from "./db";
import { carregarCadastros, condEscopo, escopoEmpresas, type ProdFiltros } from "./contabil-prod-comum";
import { faixaDe, zeroFaixas } from "./prod-escala";
import {
  FAIXAS_PARADA,
  PARADA_NUNCA,
  type ContabilCarteiraResp,
  type CtbCarteiraEmpresa,
  type CtbParetoPonto,
} from "./contabil-carteira-tipos";

/**
 * ABA CARTEIRA — cobertura do escritório: quem foi atendido no período e há
 * quanto tempo cada empresa está parada.
 *
 * Três consultas em paralelo, cada uma barata pelo seu próprio motivo:
 *
 * 1. Grão (empresa, usuário) do período — o mesmo recorte de trabalho das outras
 *    abas, agregado no banco: alguns milhares de linhas.
 * 2. `max(datahoralctoctb)` por empresa na tabela INTEIRA (35 milhões de linhas).
 *    Parece caro e não é: o Postgres resolve pelo índice do carimbo e devolve em
 *    ~2,3 s. É o que permite dizer "parada há 8 meses" em vez de só "sem
 *    movimento no período".
 * 3. A carteira ativa, do cadastro de estabelecimentos.
 *
 * O filtro de FILIAL não entra na consulta 2: "último lançamento da empresa" é
 * da empresa, e recortar por filial daria uma data que não é nem uma coisa nem
 * outra.
 */

interface GraoRow {
  e: number;
  u: number;
  n: number;
  v: number;
}

const DIA_MS = 86_400_000;

export async function montarCarteiraContabil(f: ProdFiltros): Promise<ContabilCarteiraResp> {
  const params: unknown[] = [f.inicio, f.fim];
  const conds = [`datahoralctoctb >= $1::date and datahoralctoctb < ($2::date + 1)`];
  conds.push(...(await condEscopo(f, params)));

  const paramsUltimo: unknown[] = [];
  const condsUltimo = await condEscopo(f, paramsUltimo, { filial: false });

  const escopo = await escopoEmpresas(f);
  const paramsAtivas: unknown[] = [];
  const condsAtivas = ["dataencerativ > current_date"];
  if (escopo !== "todas") {
    paramsAtivas.push(escopo);
    condsAtivas.push(`codigoempresa = any($1::int[])`);
  }

  const [grao, ultimos, ativas] = await Promise.all([
    query<GraoRow>(
      `select codigoempresa as e,
              codigousuario as u,
              count(*)::int as n,
              coalesce(sum(valorlctoctb), 0)::float as v
         from lctoctb
        where ${conds.join(" and ")}
        group by 1, 2`,
      params
    ),
    query<{ e: number; ultimo: string }>(
      `select codigoempresa as e, to_char(max(datahoralctoctb), 'YYYY-MM-DD') as ultimo
         from lctoctb
        ${condsUltimo.length ? `where ${condsUltimo.join(" and ")}` : ""}
        group by 1`,
      paramsUltimo
    ),
    query<{ e: number }>(
      `select distinct codigoempresa as e from estab where ${condsAtivas.join(" and ")}`,
      paramsAtivas
    ),
  ]);

  const movimento = new Map<number, { qtd: number; valor: number; pessoas: Map<number, number> }>();
  let lancamentos = 0;
  let valor = 0;
  for (const r of grao) {
    const m = movimento.get(r.e) ?? { qtd: 0, valor: 0, pessoas: new Map<number, number>() };
    m.qtd += r.n;
    m.valor += r.v;
    m.pessoas.set(r.u, (m.pessoas.get(r.u) ?? 0) + r.n);
    movimento.set(r.e, m);
    lancamentos += r.n;
    valor += r.v;
  }

  const mapaUltimo = new Map(ultimos.map((u) => [u.e, u.ultimo]));
  const setAtivas = new Set(ativas.map((a) => a.e));
  // A lista é a carteira ativa MAIS quem teve movimento estando baixada — uma
  // empresa encerrada que ainda recebe lançamento é fato, não erro de cadastro,
  // e sumir com ela esconderia trabalho que aconteceu.
  const codigos = [...new Set([...setAtivas, ...movimento.keys()])];
  const cadastros = await carregarCadastros({ empresas: codigos });

  const hoje = Date.now();
  const empresas: CtbCarteiraEmpresa[] = codigos
    .map((codigo) => {
      const m = movimento.get(codigo);
      const ultimo = mapaUltimo.get(codigo) ?? null;
      const diasParada = ultimo
        ? Math.max(0, Math.floor((hoje - Date.parse(ultimo + "T00:00:00Z")) / DIA_MS))
        : null;
      let principal: string | null = null;
      if (m) {
        let melhor = -1;
        for (const [u, n] of m.pessoas) {
          if (n > melhor) {
            melhor = n;
            principal = cadastros.nomeUsuario(u);
          }
        }
      }
      return {
        codigo,
        nome: cadastros.nomeEmpresa(codigo),
        ativa: setAtivas.has(codigo),
        lancamentos: m?.qtd ?? 0,
        valor: m?.valor ?? 0,
        pessoas: m?.pessoas.size ?? 0,
        principal,
        ultimo,
        diasParada,
      } satisfies CtbCarteiraEmpresa;
    })
    .sort((a, b) => b.lancamentos - a.lancamentos || a.nome.localeCompare(b.nome, "pt-BR"));

  // Faixa de parada é retrato da CARTEIRA ATIVA inteira: empresa baixada parada
  // há dois anos é o esperado, não um alerta.
  //
  // Já a CARTEIRA CONTÁBIL — ativa com lançamento no último ano — é o
  // denominador da cobertura e a base de "esquecidas". Sem esse corte, os 197
  // clientes que só fazem folha aqui entram como buraco de atendimento.
  const porFaixa = zeroFaixas(FAIXAS_PARADA);
  let esquecidas = 0;
  let contabil = 0;
  let semLancamento = 0;
  let atendidasContabil = 0;
  for (const e of empresas) {
    if (!e.ativa) continue;
    const dias = e.diasParada ?? PARADA_NUNCA;
    porFaixa[faixaDe(FAIXAS_PARADA, dias)] += 1;
    if (e.ultimo === null) semLancamento += 1;
    if (dias <= 365) {
      contabil += 1;
      if (e.lancamentos > 0) atendidasContabil += 1;
      else if (dias > 90) esquecidas += 1;
    }
  }

  const porPessoas = [0, 0, 0, 0, 0];
  for (const e of empresas) {
    if (e.pessoas === 0) continue;
    porPessoas[Math.min(e.pessoas, 5) - 1] += 1;
  }

  // Curva de concentração: empresas ordenadas do maior para o menor, acumulando.
  const atendidas = empresas.filter((e) => e.lancamentos > 0);
  const pareto: CtbParetoPonto[] = [];
  let acumulado = 0;
  let metadeEm = 0;
  atendidas.forEach((e, i) => {
    acumulado += e.lancamentos;
    const pctLancamentos = lancamentos > 0 ? (acumulado / lancamentos) * 100 : 0;
    if (metadeEm === 0 && pctLancamentos >= 50) metadeEm = i + 1;
    pareto.push({
      pctEmpresas: ((i + 1) / atendidas.length) * 100,
      pctLancamentos,
    });
  });

  return {
    periodo: { inicio: f.inicio, fim: f.fim },
    totais: {
      ativas: setAtivas.size,
      contabil,
      semLancamento,
      atendidas: atendidas.length,
      paradas: [...setAtivas].filter((c) => !movimento.has(c)).length,
      esquecidas,
      cobertura: contabil > 0 ? (atendidasContabil / contabil) * 100 : 0,
      lancamentos,
      valor,
      metadeEm,
    },
    empresas,
    porFaixa,
    porPessoas,
    pareto,
  };
}
