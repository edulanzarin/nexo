import "server-only";
import { query } from "./db";
import { carregarCadastrosFiscal, whereTrabalho } from "./fiscal-prod-comum";
import { condEscopo, escopoEmpresas, type ProdFiltros } from "./prod-comum";
import { faixaDe, zeroFaixas } from "./prod-escala";
import {
  FAIXAS_PARADA_FISCAL,
  PARADA_NUNCA,
  type FisCarteiraEmpresa,
  type FisParetoPonto,
  type FiscalCarteiraResp,
} from "./fiscal-carteira-tipos";

/**
 * ABA CARTEIRA — cobertura do fiscal: quem foi atendido no período e há quanto
 * tempo cada empresa está parada.
 *
 * Três frentes em paralelo:
 *
 * 1. Grão (empresa, usuário, lado) do período — o mesmo recorte de trabalho das
 *    outras abas, agregado no banco.
 * 2. `max(datahoralctofis)` por empresa nas tabelas INTEIRAS. Sem índice no
 *    carimbo, é varredura sequencial (~4 s cada, em paralelo) — o preço de poder
 *    dizer "parada há 8 meses" em vez de só "sem movimento no período".
 * 3. A carteira ativa, do cadastro de estabelecimentos.
 *
 * O filtro de FILIAL não entra na consulta 2: "última nota da empresa" é da
 * empresa, e recortar por filial daria uma data que não é nem uma coisa nem outra.
 */

interface GraoRow {
  e: number;
  u: number;
  lado: "ent" | "sai";
  n: number;
  v: number;
}

const DIA_MS = 86_400_000;

export async function montarCarteiraFiscal(f: ProdFiltros): Promise<FiscalCarteiraResp> {
  const w = await whereTrabalho(f);
  const selecao = (tabela: string, lado: string) =>
    `select codigoempresa, codigousuario, '${lado}'::text as lado, valorcontabil
       from ${tabela} where ${w.sql}`;

  const paramsUltimo: unknown[] = [];
  const condsUltimo = await condEscopo(f, paramsUltimo, { filial: false });
  const sqlUltimo = (tabela: string) =>
    `select codigoempresa as e, to_char(max(datahoralctofis), 'YYYY-MM-DD') as ultimo
       from ${tabela}
      ${condsUltimo.length ? `where ${condsUltimo.join(" and ")}` : ""}
      group by 1`;

  const escopo = await escopoEmpresas(f);
  const paramsAtivas: unknown[] = [];
  const condsAtivas = ["dataencerativ > current_date"];
  if (escopo !== "todas") {
    paramsAtivas.push(escopo);
    condsAtivas.push(`codigoempresa = any($1::int[])`);
  }

  const [grao, ultimoEnt, ultimoSai, ativas] = await Promise.all([
    query<GraoRow>(
      `with mov as (
         ${selecao("lctofisent", "ent")}
         union all
         ${selecao("lctofissai", "sai")}
       )
       select codigoempresa as e, codigousuario as u, lado,
              count(*)::int as n, coalesce(sum(valorcontabil), 0)::float as v
         from mov
        group by 1, 2, 3`,
      w.params
    ),
    query<{ e: number; ultimo: string }>(sqlUltimo("lctofisent"), paramsUltimo),
    query<{ e: number; ultimo: string }>(sqlUltimo("lctofissai"), paramsUltimo),
    query<{ e: number }>(
      `select distinct codigoempresa as e from estab where ${condsAtivas.join(" and ")}`,
      paramsAtivas
    ),
  ]);

  const movimento = new Map<
    number,
    { qtd: number; valor: number; ent: number; sai: number; pessoas: Map<number, number> }
  >();
  let notas = 0;
  let valor = 0;
  for (const r of grao) {
    const m =
      movimento.get(r.e) ?? { qtd: 0, valor: 0, ent: 0, sai: 0, pessoas: new Map<number, number>() };
    m.qtd += r.n;
    m.valor += r.v;
    if (r.lado === "ent") m.ent += r.n;
    else m.sai += r.n;
    m.pessoas.set(r.u, (m.pessoas.get(r.u) ?? 0) + r.n);
    movimento.set(r.e, m);
    notas += r.n;
    valor += r.v;
  }

  // Entrada e saída têm cada uma o seu "último" — a empresa está parada quando
  // os DOIS pararam, então o que vale é o mais recente dos dois.
  const mapaUltimo = new Map<number, string>();
  for (const linha of [...ultimoEnt, ...ultimoSai]) {
    const atual = mapaUltimo.get(linha.e);
    if (!atual || linha.ultimo > atual) mapaUltimo.set(linha.e, linha.ultimo);
  }

  const setAtivas = new Set(ativas.map((a) => a.e));
  // A lista é a carteira ativa MAIS quem teve movimento estando baixada — uma
  // empresa encerrada que ainda recebe nota é fato, não erro de cadastro, e
  // sumir com ela esconderia trabalho que aconteceu.
  const codigos = [...new Set([...setAtivas, ...movimento.keys()])];
  const cadastros = await carregarCadastrosFiscal(codigos);

  const hoje = Date.now();
  const empresas: FisCarteiraEmpresa[] = codigos
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
        notas: m?.qtd ?? 0,
        valor: m?.valor ?? 0,
        entradas: m?.ent ?? 0,
        saidas: m?.sai ?? 0,
        pessoas: m?.pessoas.size ?? 0,
        principal,
        ultimo,
        diasParada,
      } satisfies FisCarteiraEmpresa;
    })
    .sort((a, b) => b.notas - a.notas || a.nome.localeCompare(b.nome, "pt-BR"));

  // Faixa de parada é retrato da CARTEIRA ATIVA inteira: empresa baixada parada
  // há dois anos é o esperado, não um alerta. Já a CARTEIRA FISCAL — ativa com
  // nota no último ano — é o denominador da cobertura e a base de "esquecidas".
  const porFaixa = zeroFaixas(FAIXAS_PARADA_FISCAL);
  let esquecidas = 0;
  let fiscal = 0;
  let semNota = 0;
  let atendidasFiscal = 0;
  for (const e of empresas) {
    if (!e.ativa) continue;
    const dias = e.diasParada ?? PARADA_NUNCA;
    porFaixa[faixaDe(FAIXAS_PARADA_FISCAL, dias)] += 1;
    if (e.ultimo === null) semNota += 1;
    if (dias <= 365) {
      fiscal += 1;
      if (e.notas > 0) atendidasFiscal += 1;
      else if (dias > 90) esquecidas += 1;
    }
  }

  const porPessoas = [0, 0, 0, 0, 0];
  for (const e of empresas) {
    if (e.pessoas === 0) continue;
    porPessoas[Math.min(e.pessoas, 5) - 1] += 1;
  }

  // Curva de concentração: empresas ordenadas da maior para a menor, acumulando.
  const atendidas = empresas.filter((e) => e.notas > 0);
  const pareto: FisParetoPonto[] = [];
  let acumulado = 0;
  let metadeEm = 0;
  atendidas.forEach((e, i) => {
    acumulado += e.notas;
    const pctNotas = notas > 0 ? (acumulado / notas) * 100 : 0;
    if (metadeEm === 0 && pctNotas >= 50) metadeEm = i + 1;
    pareto.push({ pctEmpresas: ((i + 1) / atendidas.length) * 100, pctNotas });
  });

  return {
    periodo: { inicio: f.inicio, fim: f.fim },
    totais: {
      ativas: setAtivas.size,
      fiscal,
      semNota,
      atendidas: atendidas.length,
      paradas: [...setAtivas].filter((c) => !movimento.has(c)).length,
      esquecidas,
      cobertura: fiscal > 0 ? (atendidasFiscal / fiscal) * 100 : 0,
      notas,
      valor,
      metadeEm,
    },
    empresas,
    porFaixa,
    porPessoas,
    pareto,
  };
}
