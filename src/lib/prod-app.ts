import "server-only";
import { appQuery } from "./app-db";
import { query } from "./db";
import { periodoAnterior } from "./fiscal-filters";
import {
  bucketDe,
  buckets,
  escopoEmpresas,
  granularidadeDe,
  somarMapa,
  type ProdFiltros,
} from "./prod-comum";
import { zeroDe, type ProdDia, type ProdItem, type SeriePontoGen } from "./prod-tipos";
import {
  classeDaAcao,
  classesDe,
  idsDeProducao,
  trabalhosDe,
  type AcaoApp,
  type AppPessoa,
  type ModuloApp,
  type ProdAppResp,
} from "./prod-app-tipos";

/**
 * ABA NO NEXO — o trabalho que o time fez DENTRO deste app, lido da trilha de
 * auditoria. O porquê da aba, e as três consequências de o fato morar no banco
 * do app, estão em `prod-app-tipos`.
 *
 * Uma varredura só, no grão (pessoa, ação, empresa, dia, hora), e todo o rollup
 * em Node — a mesma doutrina das abas que leem o Questor. A diferença é a
 * escala: lá o grão comprime milhões de linhas; aqui a trilha inteira de um mês
 * do escritório são poucos milhares de eventos, e o grão é quase a tabela. Vale
 * do mesmo jeito, por uma razão diferente: mantém a aba com a mesma forma de
 * resposta das irmãs, então os gráficos, o ranking e a exportação são os
 * mesmos.
 *
 * Custo: irrelevante perto das outras abas — `auditoria` tem índice em
 * `criado_em desc` e o mês inteiro sai em milissegundos. É a única aba da seção
 * que não precisa de aviso de período.
 */

/** Uma linha do grão. `u` é uuid do usuário — null quando o usuário foi removido. */
interface GraoRow {
  u: string | null;
  nome: string;
  ativo: boolean | null;
  a: string;
  e: number | null;
  d: string;
  h: number;
  n: number;
}

/** Chave de quem já não existe mais no cadastro — a trilha guarda o nome, não a pessoa. */
const REMOVIDO = "removido";

/** Teto de empresas no payload: generoso porque a EXPORTAÇÃO sai daqui. */
const TOP_EMPRESAS = 200;
const TOP_EMPRESAS_PESSOA = 25;

interface Acc {
  codigo: string;
  nome: string;
  inativo: boolean;
  eventos: number;
  producao: number;
  leitura: number;
  porClasse: Record<string, number>;
  acoes: Map<string, number>;
  empresas: Map<number, number>;
  dias: Map<string, number>;
  horas: number[];
}

const novoAcc = (codigo: string, nome: string, inativo: boolean, classes: string[]): Acc => ({
  codigo,
  nome,
  inativo,
  eventos: 0,
  producao: 0,
  leitura: 0,
  porClasse: Object.fromEntries(classes.map((c) => [c, 0])),
  acoes: new Map(),
  empresas: new Map(),
  dias: new Map(),
  horas: Array.from({ length: 24 }, () => 0),
});

/**
 * Recorte da trilha: módulo, período e escopo de empresa da sessão.
 *
 * Duas regras herdadas do Painel do Contábil, que lê a mesma tabela:
 *
 * - **Evento sem empresa vale para todos.** Metade dos gestos do app não é de
 *   uma empresa (exportar o ranking do escritório, consultar sem filtro). Se o
 *   escopo os escondesse, quem não vê todas as empresas veria a própria
 *   produtividade pela metade.
 *
 *   Consequência que esta aba tem e o Painel não, porque aqui a visão é do
 *   TIME: quem enxerga poucas empresas continua vendo os gestos sem empresa dos
 *   COLEGAS — nome, contagem, verbo, hora. Está certo assim (quem alcança a
 *   seção Produtividade alcança o time por definição, e o `alvo`, que é onde
 *   moraria o dado sensível, não entra no payload), mas é uma diferença real em
 *   relação às cinco abas que leem o Questor: naquelas, todo lançamento tem
 *   empresa, então escopo vazio devolve tela vazia. Verificado: escopo `{}` aqui
 *   devolve só os eventos sem empresa, nunca o escritório inteiro.
 * - **`criado_em` é timestamptz** e o corte de período usa a data crua, sem
 *   converter fuso: é o mesmo fuso do servidor em que o `to_char` roda, então a
 *   hora do dia no gráfico e o dia no calendário contam a mesma história. Fuso
 *   fixo no SQL quebraria isso na primeira máquina em UTC.
 */
async function recorte(
  modulo: ModuloApp,
  f: ProdFiltros,
  inicio: string,
  fim: string
): Promise<{ sql: string; params: unknown[] }> {
  const params: unknown[] = [modulo, inicio, fim];
  const conds = [
    `a.modulo = $1`,
    `a.criado_em >= $2::date`,
    `a.criado_em < ($3::date + 1)`,
  ];
  const escopo = await escopoEmpresas(f);
  if (escopo !== "todas") {
    params.push(escopo);
    conds.push(`(a.codigoempresa is null or a.codigoempresa = any($${params.length}::int[]))`);
  }
  return { sql: conds.join(" and "), params };
}

/**
 * Nomes das empresas que apareceram — do QUESTOR, que pode estar fora. É a
 * única dependência externa da aba, e ela é best-effort de propósito: a tela
 * abre com "Empresa 1200" e um aviso, em vez de não abrir. Sem isto, a única
 * aba da seção que sobrevive à queda do Questor cairia junto com as outras,
 * pelo nome de uma empresa.
 */
async function nomearEmpresas(
  codigos: number[]
): Promise<{ nome: (c: number) => string; resolvidos: boolean }> {
  const fallback = { nome: (c: number) => `Empresa ${c}`, resolvidos: false };
  if (codigos.length === 0) return { ...fallback, resolvidos: true };
  try {
    const linhas = await query<{ codigo: number; nome: string | null }>(
      `select codigoempresa as codigo, btrim(nomeempresa) as nome
         from empresa where codigoempresa = any($1::int[])`,
      [codigos]
    );
    const mapa = new Map(linhas.map((e) => [e.codigo, e.nome]));
    return { nome: (c) => mapa.get(c) || `Empresa ${c}`, resolvidos: true };
  } catch (err) {
    console.error("[prod-app] Questor fora — empresas ficam sem nome:", err);
    return fallback;
  }
}

export async function montarProdutividadeApp(
  modulo: ModuloApp,
  f: ProdFiltros
): Promise<ProdAppResp> {
  const classes = classesDe(modulo);
  const idsClasse = classes.map((c) => c.id);
  const producao = new Set(idsDeProducao(modulo));
  const rotuloAcao = new Map(
    trabalhosDe(modulo).flatMap((t) => t.acoes.map((a) => [a, `${t.rotulo} · ${a}`]))
  );

  const atual = await recorte(modulo, f, f.inicio, f.fim);
  const prev = periodoAnterior(f);
  const anterior = await recorte(modulo, f, prev.inicio, prev.fim);

  /**
   * O grão junta `usuario` só para saber se a pessoa segue ativa. O NOME vem da
   * trilha, não do cadastro: `usuario_nome` é snapshot gravado no gesto, e é o
   * que continua de pé quando o usuário é removido (a FK vira null). Ler o nome
   * do cadastro faria o trabalho de quem saiu do escritório desaparecer do
   * histórico.
   */
  const sqlGrao = `
    select a.usuario_id::text as u,
           a.usuario_nome as nome,
           u.ativo as ativo,
           a.acao as a,
           a.codigoempresa as e,
           to_char(a.criado_em, 'YYYY-MM-DD') as d,
           extract(hour from a.criado_em)::int as h,
           count(*)::int as n
      from auditoria a
      left join usuario u on u.id = a.usuario_id
     where ${atual.sql}
     group by 1, 2, 3, 4, 5, 6, 7`;

  // Verbos que contam como produção — o `filter` do período anterior precisa
  // deles no SQL para o delta comparar produção com produção, e não produção
  // deste mês com o total (consultas incluídas) do mês passado.
  const acoesProducao = trabalhosDe(modulo)
    .filter((t) => t.tipo === "producao")
    .flatMap((t) => t.acoes);

  const [grao, [ant]] = await Promise.all([
    appQuery<GraoRow>(sqlGrao, atual.params),
    appQuery<{ eventos: number; producao: number }>(
      `select count(*)::int as eventos,
              count(*) filter (where a.acao = any($${anterior.params.length + 1}::text[]))::int as producao
         from auditoria a where ${anterior.sql}`,
      [...anterior.params, acoesProducao]
    ),
  ]);

  // ── Rollup ────────────────────────────────────────────────────────────────
  const pessoas = new Map<string, Acc>();
  const acoes = new Map<string, { qtd: number; pessoas: Set<string> }>();
  const empresas = new Map<number, number>();
  const dias = new Map<string, number>();
  const diasClasse = new Map<string, Record<string, number>>();
  const horas = Array.from({ length: 24 }, () => 0);
  const porClasse = zeroDe(classes);
  let eventos = 0;
  let totalProducao = 0;
  let totalLeitura = 0;

  for (const r of grao) {
    const classe = classeDaAcao(modulo, r.a);
    const ehProducao = producao.has(classe);
    const codigo = r.u ?? REMOVIDO;
    // Usuário removido não tem linha em `usuario`: `ativo` vem null e a pessoa
    // é inativa por definição, não por omissão.
    const inativo = r.ativo === null ? true : !r.ativo;

    eventos += r.n;
    if (ehProducao) totalProducao += r.n;
    else totalLeitura += r.n;
    porClasse[classe] += r.n;
    horas[r.h] += r.n;

    const ac = acoes.get(r.a) ?? { qtd: 0, pessoas: new Set<string>() };
    ac.qtd += r.n;
    ac.pessoas.add(codigo);
    acoes.set(r.a, ac);

    if (r.e != null) somarMapa(empresas, r.e, r.n);

    dias.set(r.d, (dias.get(r.d) ?? 0) + r.n);
    const dc = diasClasse.get(r.d) ?? zeroDe(classes);
    dc[classe] += r.n;
    diasClasse.set(r.d, dc);

    const p = pessoas.get(codigo) ?? novoAcc(codigo, r.nome, inativo, idsClasse);
    p.eventos += r.n;
    if (ehProducao) p.producao += r.n;
    else p.leitura += r.n;
    p.porClasse[classe] += r.n;
    p.horas[r.h] += r.n;
    somarMapa(p.acoes, r.a, r.n);
    somarMapa(p.dias, r.d, r.n);
    if (r.e != null) somarMapa(p.empresas, r.e, r.n);
    pessoas.set(codigo, p);
  }

  const { nome: nomeEmpresa, resolvidos } = await nomearEmpresas([...empresas.keys()]);

  /** Empresa aqui não tem valor em reais: o item sai com `valor` zerado, que é
   *  o campo que o `ProdItem` compartilhado pede — e a tela não mostra coluna
   *  de valor nesta aba, em vez de estampar R$ 0,00 falso. */
  const itensEmpresa = (m: Map<number, number>, teto: number): ProdItem[] =>
    [...m.entries()]
      .map(([codigo, qtd]) => ({ chave: String(codigo), nome: nomeEmpresa(codigo), qtd, valor: 0 }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, teto);

  // ── Ranking de pessoas ───────────────────────────────────────────────────
  const ranking: AppPessoa[] = [...pessoas.values()]
    .map((p) => {
      const serie: ProdDia[] = [...p.dias.entries()]
        .map(([d, n]) => ({ d, n }))
        .sort((a, b) => a.d.localeCompare(b.d));
      return {
        codigo: p.codigo,
        nome: p.nome,
        inativo: p.inativo,
        eventos: p.eventos,
        producao: p.producao,
        leitura: p.leitura,
        empresas: p.empresas.size,
        diasAtivos: p.dias.size,
        ultimo: serie.length ? serie[serie.length - 1].d : null,
        porClasse: p.porClasse,
        acoes: [...p.acoes.entries()]
          .map(([chave, qtd]) => ({ chave, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        topEmpresas: itensEmpresa(p.empresas, TOP_EMPRESAS_PESSOA),
        porHora: p.horas,
        serie,
      } satisfies AppPessoa;
    })
    // Produção primeiro: numa aba que mede trabalho, quem concluiu coisas vem
    // antes de quem consultou muito. Empate desce para o total.
    .sort((a, b) => b.producao - a.producao || b.eventos - a.eventos);

  // ── Série do time (buckets densos, quebrada por classe) ───────────────────
  const granularidade = granularidadeDe(f.inicio, f.fim);
  const ordem = buckets(f.inicio, f.fim, granularidade);
  const porBucket = new Map<string, { total: number; classes: Record<string, number> }>();
  for (const b of ordem) porBucket.set(b, { total: 0, classes: zeroDe(classes) });
  for (const [d, cls] of diasClasse) {
    const ponto = porBucket.get(bucketDe(d, granularidade));
    if (!ponto) continue; // evento fora do período pedido não existe aqui
    for (const [classe, n] of Object.entries(cls)) {
      ponto.classes[classe] += n;
      ponto.total += n;
    }
  }
  const serie: SeriePontoGen[] = ordem.map((b) => {
    const p = porBucket.get(b)!;
    return { bucket: b, total: p.total, ...p.classes };
  });

  // ── Calendário (grade diária do time) ─────────────────────────────────────
  const celulas: ProdDia[] = [...dias.entries()]
    .map(([d, n]) => ({ d, n }))
    .sort((a, b) => a.d.localeCompare(b.d));
  let pico: ProdDia | null = null;
  for (const c of celulas) if (!pico || c.n > pico.n) pico = c;

  /**
   * As ações saem com o VERBO CRU no nome quando não estão no catálogo. É o
   * único lugar da tela em que um identificador técnico aparece, e é de
   * propósito: verbo novo instrumentado no app tem de saltar aos olhos aqui
   * para ganhar classe no catálogo, em vez de engordar "Outros" em silêncio.
   */
  const listaAcoes: AcaoApp[] = [...acoes.entries()]
    .map(([chave, a]) => ({
      chave,
      nome: rotuloAcao.get(chave) ?? chave,
      classe: classeDaAcao(modulo, chave),
      qtd: a.qtd,
      valor: 0,
      pessoas: a.pessoas.size,
    }))
    .sort((a, b) => b.qtd - a.qtd);

  return {
    modulo,
    periodo: { inicio: f.inicio, fim: f.fim, granularidade },
    totais: {
      eventos,
      producao: totalProducao,
      leitura: totalLeitura,
      pessoas: ranking.length,
      empresas: empresas.size,
      diasAtivos: dias.size,
      porClasse,
    },
    anterior: { eventos: ant?.eventos ?? 0, producao: ant?.producao ?? 0 },
    ranking,
    acoes: listaAcoes,
    empresas: itensEmpresa(empresas, TOP_EMPRESAS),
    porHora: horas,
    serie,
    calendario: { inicio: f.inicio, fim: f.fim, celulas, total: eventos, pico },
    nomesResolvidos: resolvidos,
  };
}
