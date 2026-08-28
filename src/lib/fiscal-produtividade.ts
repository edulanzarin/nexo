import "server-only";
import { query } from "./db";
import { periodoAnterior } from "./fiscal-filters";
import { carregarCadastrosFiscal, whereTrabalho } from "./fiscal-prod-comum";
import {
  bucketDe,
  buckets,
  granularidadeDe,
  somarMapa,
  type ProdFiltros,
} from "./prod-comum";
import {
  zeroDe,
  type PorClasseGen,
  type ProdDia,
  type ProdItem,
  type SeriePontoGen,
} from "./prod-tipos";
import {
  ESPECIES_PROD,
  classeDaEspecie,
  rotuloNatureza,
  type FisEspecieItem,
  type FisPessoa,
  type FiscalProdutividadeResp,
} from "./fiscal-produtividade-tipos";

/**
 * PRODUTIVIDADE DO FISCAL — o que o time escriturou no período.
 *
 * Três decisões que mandam no resto:
 *
 * 1. O recorte é `datahoralctofis` (quando a nota foi LANÇADA), não
 *    `datalctofis` (a data do documento). O porquê, com o número medido, está em
 *    `fiscal-produtividade-tipos`.
 * 2. UMA consulta só, num grão fino — (usuário, empresa, espécie, origem, lado,
 *    dia, hora) — e todo o resto (ranking, espécies, empresas, série, calendário,
 *    horas) é rollup em Node. O grão é minúsculo perto das tabelas: um mês do
 *    escritório inteiro dá ~2,9 mil linhas para 1 milhão de notas, porque o
 *    fiscal escritura em lote (uma empresa inteira de uma vez). Ver [[Agregar
 *    antes de juntar em tabelas gigantes no Postgres]].
 * 3. Entrada e saída entram na MESMA varredura (`union all`) e viram duas
 *    colunas do mesmo total. São o mesmo trabalho para quem lança, e separá-las
 *    em duas telas obrigaria a somar de cabeça.
 *
 * Custo medido (escritório inteiro, sem filtro de empresa): ~4 s no mês, ~47 s
 * no ano (14,5 milhões de notas) — dentro do `statement_timeout` de 60 s, e a
 * tela roda no botão "Executar". As duas tabelas são varridas inteiras (não há
 * índice em `datahoralctofis`), então quem manda no custo não é o período e sim
 * o volume agregado; filtrar empresa derruba tudo para frações de segundo.
 */

interface GraoRow {
  u: number;
  e: number;
  esp: string | null;
  og: number | null;
  lado: "ent" | "sai";
  canc: number;
  d: string;
  h: number;
  n: number;
  v: number;
}

/**
 * Tetos de empresas. O gráfico mostra uma dúzia, mas a EXPORTAÇÃO sai daqui —
 * por isso o teto é generoso: 200 empresas cobrem o escritório inteiro, em vez
 * de entregar uma planilha truncada em 20.
 */
const TOP_EMPRESAS = 200;
/** Por pessoa o teto é menor: multiplica pelo tamanho do time no payload. */
const TOP_EMPRESAS_PESSOA = 25;

/** Acumulador interno de uma pessoa enquanto o grão é percorrido. */
interface Acc {
  codigo: number;
  notas: number;
  valor: number;
  entradas: number;
  saidas: number;
  canceladas: number;
  aDedo: number;
  porClasse: PorClasseGen;
  especies: Map<string, number>;
  naturezas: Map<string, number>;
  empresas: Map<number, { qtd: number; valor: number }>;
  dias: Map<string, number>;
  horas: number[];
  rodadas: Set<string>;
}

const novoAcc = (codigo: number): Acc => ({
  codigo,
  notas: 0,
  valor: 0,
  entradas: 0,
  saidas: 0,
  canceladas: 0,
  aDedo: 0,
  porClasse: zeroDe(ESPECIES_PROD),
  especies: new Map(),
  naturezas: new Map(),
  empresas: new Map(),
  dias: new Map(),
  horas: Array.from({ length: 24 }, () => 0),
  rodadas: new Set(),
});

/** Integração (`origemdado = 3`) é rotina; o resto é alguém sentado na cadeira. */
const ehADedo = (og: number | null) => og !== 3;

export async function montarProdutividadeFiscal(
  f: ProdFiltros
): Promise<FiscalProdutividadeResp> {
  const w = await whereTrabalho(f);
  const prev = periodoAnterior(f);
  const paramsPrev = [prev.inicio, prev.fim, ...w.params.slice(2)];

  const selecao = (tabela: string, lado: string) => `
    select codigousuario as u, codigoempresa as e,
           upper(btrim(especienf)) as esp, origemdado as og, '${lado}'::text as lado,
           (cancelada = '1') as cancelada, valorcontabil, datahoralctofis
      from ${tabela} where ${w.sql}`;

  const sqlGrao = `
    with mov as (
      ${selecao("lctofisent", "ent")}
      union all
      ${selecao("lctofissai", "sai")}
    )
    select u, e, esp, og, lado,
           count(*) filter (where cancelada)::int as canc,
           to_char(datahoralctofis, 'YYYY-MM-DD') as d,
           extract(hour from datahoralctofis)::int as h,
           count(*)::int as n,
           coalesce(sum(valorcontabil), 0)::float as v
      from mov
     group by u, e, esp, og, lado, d, h`;

  const sqlTotal = `
    select count(*)::int as n, coalesce(sum(valorcontabil), 0)::float as v from (
      select valorcontabil from lctofisent where ${w.sql}
      union all
      select valorcontabil from lctofissai where ${w.sql}
    ) t`;

  // Grão + período anterior em paralelo: o delta não espera a varredura grande.
  const [grao, [ant]] = await Promise.all([
    query<GraoRow>(sqlGrao, w.params),
    query<{ n: number; v: number }>(sqlTotal, paramsPrev),
  ]);

  // ── Rollup ────────────────────────────────────────────────────────────────
  const pessoas = new Map<number, Acc>();
  const especies = new Map<string, { qtd: number; valor: number; pessoas: Set<number> }>();
  const naturezas = new Map<string, { qtd: number; valor: number }>();
  const empresas = new Map<number, { qtd: number; valor: number }>();
  const dias = new Map<string, number>();
  const diasClasse = new Map<string, PorClasseGen>();
  const horas = Array.from({ length: 24 }, () => 0);
  const rodadas = new Set<string>();
  let notas = 0;
  let valor = 0;
  let entradas = 0;
  let saidas = 0;
  let canceladas = 0;
  let aDedo = 0;

  for (const r of grao) {
    const classe = classeDaEspecie(r.esp);
    const nat = String(r.og ?? 0);
    const dedo = ehADedo(r.og) ? r.n : 0;
    notas += r.n;
    valor += r.v;
    if (r.lado === "ent") entradas += r.n;
    else saidas += r.n;
    canceladas += r.canc;
    aDedo += dedo;
    horas[r.h] += r.n;
    rodadas.add(`${r.u}|${r.e}|${classe}|${r.d}`);

    const esp = especies.get(classe) ?? { qtd: 0, valor: 0, pessoas: new Set<number>() };
    esp.qtd += r.n;
    esp.valor += r.v;
    esp.pessoas.add(r.u);
    especies.set(classe, esp);

    const nt = naturezas.get(nat) ?? { qtd: 0, valor: 0 };
    nt.qtd += r.n;
    nt.valor += r.v;
    naturezas.set(nat, nt);

    const emp = empresas.get(r.e) ?? { qtd: 0, valor: 0 };
    emp.qtd += r.n;
    emp.valor += r.v;
    empresas.set(r.e, emp);

    dias.set(r.d, (dias.get(r.d) ?? 0) + r.n);
    const dc = diasClasse.get(r.d) ?? zeroDe(ESPECIES_PROD);
    dc[classe] += r.n;
    diasClasse.set(r.d, dc);

    const p = pessoas.get(r.u) ?? novoAcc(r.u);
    p.notas += r.n;
    p.valor += r.v;
    if (r.lado === "ent") p.entradas += r.n;
    else p.saidas += r.n;
    p.canceladas += r.canc;
    p.aDedo += dedo;
    p.porClasse[classe] += r.n;
    p.horas[r.h] += r.n;
    p.rodadas.add(`${r.e}|${classe}|${r.d}`);
    somarMapa(p.especies, classe, r.n);
    somarMapa(p.naturezas, nat, r.n);
    somarMapa(p.dias, r.d, r.n);
    const pe = p.empresas.get(r.e) ?? { qtd: 0, valor: 0 };
    pe.qtd += r.n;
    pe.valor += r.v;
    p.empresas.set(r.e, pe);
    pessoas.set(r.u, p);
  }

  // ── Cadastros de apoio (só o necessário para nomear o que apareceu) ───────
  const cadastros = await carregarCadastrosFiscal([...empresas.keys()]);
  const itensEmpresa = (m: Map<number, { qtd: number; valor: number }>, teto: number): ProdItem[] =>
    [...m.entries()]
      .map(([codigo, v]) => ({ chave: String(codigo), nome: cadastros.nomeEmpresa(codigo), ...v }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, teto);

  // ── Ranking de pessoas ───────────────────────────────────────────────────
  const ranking: FisPessoa[] = [...pessoas.values()]
    .map((p) => {
      const serie: ProdDia[] = [...p.dias.entries()]
        .map(([d, n]) => ({ d, n }))
        .sort((a, b) => a.d.localeCompare(b.d));
      return {
        codigo: p.codigo,
        nome: cadastros.nomeUsuario(p.codigo),
        inativo: cadastros.usuarioInativo(p.codigo),
        notas: p.notas,
        valor: p.valor,
        entradas: p.entradas,
        saidas: p.saidas,
        canceladas: p.canceladas,
        aDedo: p.aDedo,
        empresas: p.empresas.size,
        diasAtivos: p.dias.size,
        rodadas: p.rodadas.size,
        ultimo: serie.length ? serie[serie.length - 1].d : null,
        porClasse: p.porClasse,
        especies: [...p.especies.entries()]
          .map(([chave, qtd]) => ({ chave, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        naturezas: [...p.naturezas.entries()]
          .map(([chave, qtd]) => ({ chave, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        topEmpresas: itensEmpresa(p.empresas, TOP_EMPRESAS_PESSOA),
        porHora: p.horas,
        serie,
      } satisfies FisPessoa;
    })
    .sort((a, b) => b.notas - a.notas);

  // ── Série do time (buckets densos, quebrada por espécie) ──────────────────
  const granularidade = granularidadeDe(f.inicio, f.fim);
  // A classe é acumulada num mapa à parte e só vira ponto ACHATADO no fim: o
  // gráfico lê cada espécie por nome de propriedade, mas somar direto num objeto
  // com índice `string | number` não passa no compilador.
  const porBucket = new Map<string, { total: number; classes: Record<string, number> }>();
  const ordem = buckets(f.inicio, f.fim, granularidade);
  for (const b of ordem) porBucket.set(b, { total: 0, classes: zeroDe(ESPECIES_PROD) });
  for (const [d, classes] of diasClasse) {
    const ponto = porBucket.get(bucketDe(d, granularidade));
    if (!ponto) continue; // nota fora do período pedido não existe aqui
    for (const [classe, n] of Object.entries(classes)) {
      ponto.classes[classe] += n;
      ponto.total += n;
    }
  }
  const serieTime: SeriePontoGen[] = ordem.map((b) => {
    const p = porBucket.get(b)!;
    return { bucket: b, total: p.total, ...p.classes };
  });

  // ── Calendário (grade diária do time) ─────────────────────────────────────
  const celulas: ProdDia[] = [...dias.entries()]
    .map(([d, n]) => ({ d, n }))
    .sort((a, b) => a.d.localeCompare(b.d));
  let pico: ProdDia | null = null;
  for (const c of celulas) if (!pico || c.n > pico.n) pico = c;

  const totaisClasse = zeroDe(ESPECIES_PROD);
  for (const p of ranking) {
    for (const [classe, n] of Object.entries(p.porClasse)) totaisClasse[classe] += n;
  }

  // A ordem do catálogo manda na faixa e na legenda; o ranking de barras é por
  // quantidade. São leituras diferentes e cada uma ordena do seu jeito.
  const listaEspecies: FisEspecieItem[] = ESPECIES_PROD.filter((c) => especies.has(c.id))
    .map((c) => {
      const e = especies.get(c.id)!;
      return { chave: c.id, nome: c.rotulo, qtd: e.qtd, valor: e.valor, pessoas: e.pessoas.size };
    })
    .sort((a, b) => b.qtd - a.qtd);

  const listaNaturezas: ProdItem[] = [...naturezas.entries()]
    .map(([chave, n]) => ({ chave, nome: rotuloNatureza(Number(chave)), ...n }))
    .sort((a, b) => b.qtd - a.qtd);

  return {
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      notas,
      valor,
      pessoas: ranking.filter((p) => p.codigo !== 0).length,
      empresas: empresas.size,
      rodadas: rodadas.size,
      diasAtivos: dias.size,
      entradas,
      saidas,
      canceladas,
      aDedo,
      porClasse: totaisClasse,
    },
    anterior: { notas: ant?.n ?? 0, valor: ant?.v ?? 0 },
    ranking,
    especies: listaEspecies,
    naturezas: listaNaturezas,
    empresas: itensEmpresa(empresas, TOP_EMPRESAS),
    porHora: horas,
    serie: serieTime,
    calendario: { inicio: f.inicio, fim: f.fim, celulas, total: notas, pico },
  };
}
