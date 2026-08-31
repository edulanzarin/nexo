import "server-only";
import { query } from "./db";
import { FilterError } from "./fiscal-filters";
import { getSessaoOpcional, empresasPermitidas } from "./sessao";
import {
  DP_TIPOS,
  infoDoTipo,
  zeroPorTipo,
  type DpColaborador,
  type DpLinha,
  type DpPorTipo,
  type DpQuebra,
  type DpQuebraItem,
  type DpResumo,
  type DpSeriePonto,
  type DpTipo,
  type EsocialStatus,
} from "./dp-tipos";

/**
 * Produtividade do DP — "quem fez o quê" na folha, no período. DOZE trabalhos,
 * cada um numa tabela do Questor, todos com a auditoria embutida
 * (`codigousuario` + `datahoralcto`) que já é o padrão do Fiscal. A lista mora
 * no catálogo `DP_TIPOS`, e toda a montagem de SQL sai dele: acrescentar fonte é
 * uma linha lá, não uma coluna aqui, no tipo, na tela e em três componentes.
 *
 * Eram quatro até ago/2026, e os quatro mediam o que acontece EM VOLTA da folha
 * — admitir, demitir, dar férias. A folha em si não era medida: `funcpercalculo`
 * tem ~7 mil cálculos por mês feitos por 24 pessoas, e não aparecia. Entraram
 * junto o fechamento (encargos, base do eSocial, provisão de 13º), a manutenção
 * do contrato vivo (afastamento, reajuste, cargo) e a transmissão ao eSocial.
 *
 * O recorte é por `datahoralcto` (quando o trabalho foi lançado/calculado), NÃO
 * pela data do fato (dataadm/dataresc) — é produtividade, mede o que o DP fez no
 * período. Ver [[Módulo de folha e eSocial do Questor]] e [[Logs e auditoria no Questor]].
 *
 * Escopo de empresa: mesmo funil da Folha/Fiscal — a sessão manda, a lista do
 * cliente só afunila (interseção). Diferente da Rotatividade, aqui a empresa é
 * OPCIONAL: sem empresa, varre todo o escopo (é o retrato do escritório).
 */

export interface DpFiltros {
  inicio: string;
  fim: string;
  empresas: number[];
  /** Filtra por um usuário do Questor (codigousuario). null = todos. */
  usuario: number | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Teto de período: 1 ano, como no resto do app (evita varredura larga). */
const MAX_DIAS = 366;

export function parseDpFiltros(sp: URLSearchParams): DpFiltros {
  const inicio = sp.get("inicio") ?? "";
  const fim = sp.get("fim") ?? "";
  if (!DATE_RE.test(inicio) || !DATE_RE.test(fim)) {
    throw new FilterError("Período inválido: informe inicio e fim como YYYY-MM-DD");
  }
  if (inicio > fim) throw new FilterError("Data inicial maior que a final");
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000 + 1;
  if (dias > MAX_DIAS) throw new FilterError("Período máximo permitido: 1 ano");

  const empresas = (sp.get("empresas") ?? "")
    .split(",")
    .filter(Boolean)
    .map((v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new FilterError(`Empresa inválida: ${v}`);
      return n;
    });

  const uRaw = sp.get("usuario");
  const usuario = uRaw != null && uRaw !== "" ? Number(uRaw) : null;
  if (usuario != null && !Number.isInteger(usuario)) {
    throw new FilterError(`Usuário inválido: ${uRaw}`);
  }

  return { inicio, fim, empresas, usuario };
}

/**
 * Escopo de empresa efetivo: `"todas"` = sem restrição de empresa (só o filtro do
 * cliente, se houver); senão a lista de códigos permitidos (interseção com o
 * pedido). Lista vazia não casa nada — usuário sem empresa não vê nada.
 */
async function escopoEmpresas(f: DpFiltros): Promise<number[] | "todas"> {
  const sessao = await getSessaoOpcional();
  const escopo: number[] | "todas" = sessao ? empresasPermitidas(sessao) : [];
  if (escopo === "todas") return f.empresas.length ? f.empresas : "todas";
  return f.empresas.length ? f.empresas.filter((e) => escopo.includes(e)) : escopo;
}

/**
 * Monta `[params, condEmpresa]` para uma consulta: params começa com [inicio,
 * fim] e, quando o escopo restringe, ganha o array de empresas; `condEmpresa` é
 * o fragmento SQL (` and codigoempresa = any($N::int[])`) ou vazio. Como o mesmo
 * array serve as quatro tabelas do UNION, todas referenciam o mesmo `$N`.
 */
async function baseParams(
  f: DpFiltros
): Promise<{ params: unknown[]; condEmpresa: string; usuarioIdx: number | null }> {
  const scope = await escopoEmpresas(f);
  const params: unknown[] = [f.inicio, f.fim];
  let condEmpresa = "";
  if (scope !== "todas") {
    params.push(scope);
    condEmpresa = ` and codigoempresa = any($${params.length}::int[])`;
  }
  let usuarioIdx: number | null = null;
  if (f.usuario != null) {
    params.push(f.usuario);
    usuarioIdx = params.length;
  }
  return { params, condEmpresa, usuarioIdx };
}

/** Nome do usuário legível, com fallback — repetido nas duas consultas. */
const NOME_USUARIO = `coalesce(nullif(btrim(u.nomeusuariocompl), ''), nullif(btrim(u.nomeusuario), ''), 'Usuário ' || sub.codigousuario)`;

/** nomefunc do Questor vem com espaços/tabs no fim; limpa o conjunto todo. */
const NOME_FUNC = `btrim(p.nomefunc, E' \\t\\r\\n')`;

type RankRow = ContagemRow & {
  codigousuario: number;
  nome: string;
  inativo: boolean;
};

/** Tabela do Questor onde cada trabalho é registrado (a fonte de auditoria). */
const TABELA = Object.fromEntries(DP_TIPOS.map((t) => [t.id, t.tabela])) as Record<DpTipo, string>;

/**
 * Une as doze fontes num intervalo (usado no período e no anterior). O nome da
 * tabela e o rótulo do tipo saem do CATÁLOGO, nunca de entrada do usuário —
 * interpolar identificador em SQL só é seguro porque a lista é fechada e mora
 * no código; o período e o escopo continuam parametrizados ($1, $2, $n).
 */
function subFonte(condEmpresa: string): string {
  return DP_TIPOS.map((t) => {
    // `gesto` identifica o ATO. Onde a fonte grava uma linha por funcionário
    // (folha, encargos, base do eSocial, provisão), é a chave do lote; onde a
    // linha já é o ato, vai nulo e a contagem cai no `count(*)`.
    const gesto = t.gesto
      ? `(${t.gesto.split(", ").join(" || '|' || ")})::text`
      : `null::text`;
    return (
      `select codigoempresa, codigousuario, '${t.id}'::text tipo, ${gesto} as gesto` +
      ` from ${t.tabela} where datahoralcto::date between $1 and $2${condEmpresa}`
    );
  }).join("\n    union all\n    ");
}

/**
 * Contagem por tipo — em GESTOS, não em linhas. O tipo que grava uma linha por
 * funcionário conta `distinct gesto`; o resto conta linha. Sem isso, fechar
 * encargos (137 atos, 18.504 linhas) apareceria como o maior trabalho do DP.
 */
const CONTAGENS = DP_TIPOS.map((t) =>
  t.gesto
    ? `count(distinct gesto) filter (where tipo = '${t.id}')::int as ${t.id}`
    : `count(*) filter (where tipo = '${t.id}')::int as ${t.id}`
).join(",\n            ");

/**
 * As LINHAS por tipo, com alias prefixado para conviver com as contagens de
 * gesto na mesma linha de resultado. Servem à tela dizer "137 fechamentos,
 * 18.504 linhas" — o tamanho do lote é informação, só não é a unidade.
 */
const LINHAS_ALIAS = DP_TIPOS.map(
  (t) => `count(*) filter (where tipo = '${t.id}')::int as l_${t.id}`
).join(",\n            ");

type LinhasRow = Record<`l_${DpTipo}`, number>;

function colherLinhas(row: Partial<LinhasRow> | undefined): DpPorTipo {
  const out = zeroPorTipo();
  for (const t of DP_TIPOS) out[t.id] = row?.[`l_${t.id}`] ?? 0;
  return out;
}

/** Linha crua do banco: uma coluna por tipo do catálogo, mais os campos do autor. */
type ContagemRow = Record<DpTipo, number>;

/** Colhe as colunas do catálogo numa contagem tipada, sem depender da ordem. */
function colher(row: Partial<ContagemRow> | undefined): DpPorTipo {
  const out = zeroPorTipo();
  for (const t of DP_TIPOS) out[t.id] = row?.[t.id] ?? 0;
  return out;
}

const somar = (p: DpPorTipo) => DP_TIPOS.reduce((a, t) => a + p[t.id], 0);

/** Período imediatamente anterior, mesma duração — para o delta dos KPIs. */
function anterior(f: DpFiltros): { inicio: string; fim: string } {
  const ini = new Date(f.inicio + "T00:00:00Z");
  const fim = new Date(f.fim + "T00:00:00Z");
  const dias = Math.round((fim.getTime() - ini.getTime()) / 86_400_000) + 1;
  const prevFim = new Date(ini.getTime() - 86_400_000);
  const prevIni = new Date(prevFim.getTime() - (dias - 1) * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: iso(prevIni), fim: iso(prevFim) };
}

export async function montarResumoDp(f: DpFiltros): Promise<DpResumo> {
  const { params, condEmpresa, usuarioIdx } = await baseParams(f);
  const filtroUsuario = usuarioIdx != null ? ` and codigousuario = $${usuarioIdx}` : "";

  // Ranking por usuário no período. Envolve as fontes num sub `sub` para o
  // fallback de nome referenciar sub.codigousuario.
  const rows = await query<RankRow>(
    `with fonte as (${subFonte(condEmpresa)})
     select sub.codigousuario,
            ${NOME_USUARIO} as nome,
            (u.databaixausuario is not null) as inativo,
            ${CONTAGENS}
       from (select * from fonte where true${filtroUsuario}) sub
       left join usuario u on u.codigousuario = sub.codigousuario
      group by sub.codigousuario, u.nomeusuariocompl, u.nomeusuario, u.databaixausuario`,
    params
  );

  const ranking = rows
    .map<DpColaborador>((r) => {
      const porTipo = colher(r);
      return {
        codigo: r.codigousuario,
        nome: r.codigousuario === 0 ? "Sistema (automático)" : r.nome,
        auto: r.codigousuario === 0,
        inativo: r.inativo,
        porTipo,
        total: somar(porTipo),
      };
    })
    .sort((a, b) => b.total - a.total);

  /**
   * Totais do período NÃO saem da soma do ranking. Com contagem por gesto, um
   * lote tocado por duas pessoas conta uma vez para cada uma (o que está certo
   * no ranking — cada uma agiu) e contaria duas no total do escritório. O total
   * é agregado próprio, sobre a mesma fonte, sem agrupar por usuário.
   */
  const prev = anterior(f);
  const prevParams: unknown[] = [prev.inicio, prev.fim, ...params.slice(2)];
  const sqlTotais = `with fonte as (${subFonte(condEmpresa)})
     select ${CONTAGENS}, ${LINHAS_ALIAS} from (select * from fonte where true${filtroUsuario}) x`;

  const [[tot], [ant]] = await Promise.all([
    query<ContagemRow & LinhasRow>(sqlTotais, params),
    query<ContagemRow & LinhasRow>(sqlTotais, prevParams),
  ]);
  const porTipo = colher(tot);
  const totais = { porTipo, total: somar(porTipo), linhas: colherLinhas(tot) };
  const antPorTipo = colher(ant);

  return {
    ranking,
    totais,
    anterior: { porTipo: antPorTipo, total: somar(antPorTipo), linhas: colherLinhas(ant) },
    colaboradores: ranking.filter((c) => !c.auto && c.total > 0).length,
  };
}

/** Limite de linhas de detalhe — o dashboard resume; a lista é para conferência. */
const LIMITE_LISTA = 1000;

/** origemdado (1 manual, 2 importado, 3 integração) → rótulo. */
const ORIGEM = `case origemdado when 1 then 'Manual' when 2 then 'Importado' when 3 then 'Integração' else null end`;

const JOINS_COMUNS = `
    join funccontrato fc on fc.codigoempresa = src.codigoempresa and fc.codigofunccontr = src.codigofunccontr
    left join funcpessoa p on p.codigofuncpessoa = fc.codigofuncpessoa
    left join empresa e on e.codigoempresa = src.codigoempresa
    left join usuario u on u.codigousuario = src.codigousuario`;

/** Colunas comuns a toda linha de detalhe (a fonte é sempre o alias `src`). */
const SELECT_COMUM = `
    src.codigoempresa,
    coalesce(nullif(btrim(e.nomeempresa), ''), 'Empresa ' || src.codigoempresa) as empresa,
    src.codigofunccontr as contrato,
    coalesce(nullif(${NOME_FUNC}, ''), '(sem nome)') as funcionario,
    coalesce(nullif(btrim(u.nomeusuariocompl), ''), nullif(btrim(u.nomeusuario), ''), 'Usuário ' || src.codigousuario) as usuario,
    src.codigousuario,
    to_char(src.datahoralcto, 'YYYY-MM-DD"T"HH24:MI:SS') as quando`;

interface ListaRawBase {
  codigoempresa: number;
  empresa: string;
  contrato: number;
  funcionario: string;
  usuario: string;
  codigousuario: number;
  quando: string;
}

export async function montarListaDp(f: DpFiltros, tipo: DpTipo): Promise<DpLinha[]> {
  const { params, condEmpresa, usuarioIdx } = await baseParams(f);
  // O escopo de empresa entra qualificado por `src` (a fonte). O condEmpresa
  // genérico usa `codigoempresa` cru; aqui reescrevo para `src.codigoempresa`.
  const condEmp = condEmpresa.replace("codigoempresa", "src.codigoempresa");
  const condUsuario = usuarioIdx != null ? ` and src.codigousuario = $${usuarioIdx}` : "";
  const where = `where src.datahoralcto::date between $1 and $2${condEmp}${condUsuario}`;
  const ordem = `order by src.datahoralcto desc limit ${LIMITE_LISTA}`;

  if (tipo === "avisos" || tipo === "rescisoes") {
    const tabela = tipo === "avisos" ? "funcavisoprevio" : "rescisao";
    const rows = await query<
      ListaRawBase & { causa: string | null; data_aviso: string | null; data_resc: string | null }
    >(
      `select ${SELECT_COMUM},
              cd.descrcausa as causa,
              to_char(src.dataavprevio, 'YYYY-MM-DD') as data_aviso,
              to_char(src.dataresc, 'YYYY-MM-DD') as data_resc
         from ${tabela} src
         ${JOINS_COMUNS}
         left join causademissao cd on cd.codigocausa = src.codigocausa
         ${where}
         ${ordem}`,
      params
    );
    return rows.map((r) => ({
      codigoempresa: r.codigoempresa,
      empresa: r.empresa,
      contrato: r.contrato,
      funcionario: r.funcionario,
      usuario: r.usuario,
      codigousuario: r.codigousuario,
      quando: r.quando,
      causa: r.causa,
      dataAviso: r.data_aviso,
      dataResc: r.data_resc,
    }));
  }

  if (tipo === "admissoes") {
    const rows = await query<
      ListaRawBase & { data_adm: string | null; origem: string | null; esocial: EsocialStatus }
    >(
      `select ${SELECT_COMUM},
              to_char(src.dataadm, 'YYYY-MM-DD') as data_adm,
              (${ORIGEM.replace("origemdado", "src.origemdado")}) as origem,
              case
                when t.recibo is not null and btrim(t.recibo) <> '' then 'ok'
                when t.codigoesocialtransacao is not null then 'pendente'
                else 'nao_enviado'
              end as esocial
         from funccontrato src
         left join funcpessoa p on p.codigofuncpessoa = src.codigofuncpessoa
         left join empresa e on e.codigoempresa = src.codigoempresa
         left join usuario u on u.codigousuario = src.codigousuario
         left join lateral (
           select et.recibo, et.codigoesocialtransacao
             from esocialdadoss2200 d
             join esocialtransacao et
               on et.codigoempresa = d.codigoempresa and et.codigoesocialtransacao = d.codigoesocialtransacao
            where d.codigoempresa = src.codigoempresa and d.codigofunccontr = src.codigofunccontr
              and et.evento = 'S-2200'
            order by et.datahoralcto desc
            limit 1
         ) t on true
         ${where}
         ${ordem}`,
      params
    );
    return rows.map((r) => ({
      codigoempresa: r.codigoempresa,
      empresa: r.empresa,
      contrato: r.contrato,
      funcionario: r.funcionario,
      usuario: r.usuario,
      codigousuario: r.codigousuario,
      quando: r.quando,
      dataAdm: r.data_adm,
      origem: r.origem,
      esocial: r.esocial,
    }));
  }

  if (tipo === "esocial") {
    // Sem `codigofunccontr`: o evento é da EMPRESA, não de um contrato. A linha
    // mostra o evento no lugar do funcionário em vez de inventar um join que a
    // tabela não sustenta.
    const rows = await query<
      Omit<ListaRawBase, "contrato" | "funcionario"> & { evento: string | null }
    >(
      `select src.codigoempresa,
              coalesce(nullif(btrim(e.nomeempresa), ''), 'Empresa ' || src.codigoempresa) as empresa,
              coalesce(nullif(btrim(u.nomeusuariocompl), ''), nullif(btrim(u.nomeusuario), ''), 'Usuário ' || src.codigousuario) as usuario,
              src.codigousuario,
              to_char(src.datahoralcto, 'YYYY-MM-DD"T"HH24:MI:SS') as quando,
              nullif(btrim(src.evento), '') as evento
         from esocialtransacao src
         left join empresa e on e.codigoempresa = src.codigoempresa
         left join usuario u on u.codigousuario = src.codigousuario
         ${where}
         ${ordem}`,
      params
    );
    return rows.map((r) => ({
      codigoempresa: r.codigoempresa,
      empresa: r.empresa,
      contrato: 0,
      funcionario: "—",
      usuario: r.usuario,
      codigousuario: r.codigousuario,
      quando: r.quando,
      evento: r.evento,
    }));
  }

  /**
   * Os trabalhos que entraram em ago/2026 (folha, encargos, base do eSocial,
   * provisão, afastamento, reajuste, cargo) partilham a MESMA forma: contrato +
   * autor + carimbo. Não ganham consulta própria porque não têm campo próprio
   * que valha a coluna — o que a lista precisa responder ali é "quem, em que
   * empresa, para qual funcionário e quando", e isso é o `SELECT_COMUM`.
   */
  const info = infoDoTipo(tipo);
  if (tipo !== "ferias") {
    const rows = await query<ListaRawBase>(
      `select ${SELECT_COMUM}
         from ${info.tabela} src
         ${JOINS_COMUNS}
         ${where}
         ${ordem}`,
      params
    );
    return rows.map((r) => ({
      codigoempresa: r.codigoempresa,
      empresa: r.empresa,
      contrato: r.contrato,
      funcionario: r.funcionario,
      usuario: r.usuario,
      codigousuario: r.codigousuario,
      quando: r.quando,
    }));
  }

  // férias
  const rows = await query<
    ListaRawBase & {
      inicio_ferias: string | null;
      fim_ferias: string | null;
      periodo_aquis: string | null;
      data_pgto: string | null;
    }
  >(
    `select ${SELECT_COMUM},
            to_char(src.datainicialferias, 'YYYY-MM-DD') as inicio_ferias,
            to_char(src.datafinalferias, 'YYYY-MM-DD') as fim_ferias,
            to_char(src.datainicial, 'YYYY-MM-DD') as periodo_aquis,
            to_char(src.datapgto, 'YYYY-MM-DD') as data_pgto
       from reciboferias src
       ${JOINS_COMUNS}
       ${where}
       ${ordem}`,
    params
  );
  return rows.map((r) => ({
    codigoempresa: r.codigoempresa,
    empresa: r.empresa,
    contrato: r.contrato,
    funcionario: r.funcionario,
    usuario: r.usuario,
    codigousuario: r.codigousuario,
    quando: r.quando,
    inicioFerias: r.inicio_ferias,
    fimFerias: r.fim_ferias,
    periodoAquisitivo: r.periodo_aquis,
    dataPgto: r.data_pgto,
  }));
}

/**
 * Quebra de UM trabalho no período: por empresa e no tempo (série). Alimenta a
 * aba completa do tipo. Respeita o mesmo escopo/usuário das outras consultas —
 * quando um colaborador está selecionado, é o retrato só dele.
 *
 * A série vira mensal em períodos longos (> 92 dias) pra não desenhar 300 barras;
 * os buckets são densos (generate_series preenche os dias/meses sem movimento).
 */
export async function montarQuebraDp(f: DpFiltros, tipo: DpTipo): Promise<DpQuebra> {
  const { params, condEmpresa, usuarioIdx } = await baseParams(f);
  const tabela = TABELA[tipo];
  const condEmp = condEmpresa.replace("codigoempresa", "src.codigoempresa");
  const condUsuario = usuarioIdx != null ? ` and src.codigousuario = $${usuarioIdx}` : "";
  const filtros = `src.datahoralcto::date between $1 and $2${condEmp}${condUsuario}`;

  const dias = (Date.parse(f.fim) - Date.parse(f.inicio)) / 86_400_000 + 1;
  const granularidade: "dia" | "mes" = dias > 92 ? "mes" : "dia";
  const passo = granularidade === "mes" ? "1 month" : "1 day";
  const truncSrc = granularidade === "mes" ? "date_trunc('month', src.datahoralcto)::date" : "src.datahoralcto::date";
  const truncGen = granularidade === "mes" ? "date_trunc('month', $1::date)" : "$1::date";
  const fmt = granularidade === "mes" ? "YYYY-MM" : "YYYY-MM-DD";

  const [porEmpresa, serie] = await Promise.all([
    query<DpQuebraItem>(
      `select src.codigoempresa as codigo,
              coalesce(nullif(btrim(e.nomeempresa), ''), 'Empresa ' || src.codigoempresa) as nome,
              count(*)::int as qtd
         from ${tabela} src
         left join empresa e on e.codigoempresa = src.codigoempresa
        where ${filtros}
        group by src.codigoempresa, e.nomeempresa
        order by qtd desc
        limit 500`,
      params
    ),
    query<DpSeriePonto>(
      `select to_char(g.b, '${fmt}') as bucket, coalesce(c.qtd, 0)::int as qtd
         from generate_series(${truncGen}, $2::date, interval '${passo}') g(b)
         left join (
           select ${truncSrc} as b, count(*)::int as qtd
             from ${tabela} src
            where ${filtros}
            group by 1
         ) c on c.b = g.b::date
        order by g.b`,
      params
    ),
  ]);

  return { porEmpresa, granularidade, serie };
}

export { FilterError };
