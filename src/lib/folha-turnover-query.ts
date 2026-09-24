import "server-only";
import { query } from "./db";
import { parseFilters, FilterError, periodoAnterior, type FiscalFilters } from "./fiscal-filters";
import {
  construirBase,
  parseFolhaFiltrosSel,
  sexoValor,
  type FolhaFiltrosSel,
  EXPR_FAIXA_ETARIA,
  EXPR_TENURE_FAIXA,
  EXPR_ESCOLARIDADE,
  EXPR_ESTADOCIVIL,
} from "./folha-turnover";
import type {
  FolhaMovimentacao,
  TurnoverContagem,
  TurnoverGrupo,
  TurnoverPonto,
  TurnoverResp,
} from "./types";

/**
 * Cálculo do turnover — a consulta-mãe da Rotatividade. Extraída da rota da
 * Folha para ser reusada pelo RH (mesma query, empresa forçada nas do RH —
 * NAVECON/FOUR/FINAVE): o que dois módulos compartilham é a QUERY, não a rota. A
 * Folha chama sem `empresasForcadas` (escopo da sessão); o RH passa as empresas do RH.
 */
interface GrupoRaw {
  grupo: string;
  ativos: number;
  adm: number;
  dem: number;
}
interface SerieRaw {
  mes: string;
  adm: number;
  dem: number;
  ativos: number;
}
interface MegaRaw {
  adm: number;
  dem: number;
  ativos: number;
  voluntarios: number;
  involuntarios: number;
  tempomedio: number | null;
  prevadm: number;
  prevdem: number;
  prevativos: number;
  serie: SerieRaw[];
  organogramas: GrupoRaw[];
  cargos: GrupoRaw[];
  estabs: GrupoRaw[];
  sexo: GrupoRaw[];
  idade: GrupoRaw[];
  escolaridade: GrupoRaw[];
  estadocivil: GrupoRaw[];
  horarios: GrupoRaw[];
  motivos: TurnoverContagem[];
  tenure: TurnoverContagem[];
}

/**
 * Turnover = ((admissões + desligamentos) / 2) ÷ colaboradores ativos × 100.
 * "Ativos" é o efetivo no fim do intervalo (o denominador do DP). Zero quando
 * não há ativos (evita dividir por zero).
 */
export function indice(adm: number, dem: number, ativos: number): number {
  return ativos > 0 ? ((adm + dem) / 2 / ativos) * 100 : 0;
}

function paraGrupo(r: GrupoRaw): TurnoverGrupo {
  return {
    grupo: r.grupo,
    ativos: r.ativos,
    admissoes: r.adm,
    desligamentos: r.dem,
    turnover: indice(r.adm, r.dem, r.ativos),
  };
}

export async function montarTurnover(
  f: FiscalFilters,
  sel: FolhaFiltrosSel,
  empresasForcadas?: number[]
): Promise<TurnoverResp> {
  const { cte, params } = await construirBase(f, sel, true, empresasForcadas);

  // Período anterior (mesma duração) para os deltas — nos mesmos parâmetros.
  const prev = periodoAnterior(f);
  params.push(prev.inicio);
  const pIni = `$${params.length}`;
  params.push(prev.fim);
  const pFim = `$${params.length}`;

  // Agregado de grupo reutilizado por setor/cargo/estab/sexo/idade.
  const grupoAgg = (dim: string) =>
    `(select coalesce(json_agg(x order by x.ativos desc, x.grupo), '[]'::json) from (
        select ${dim} as grupo,
               count(*) filter (where at_fim)::int as ativos,
               count(*) filter (where dataadm between $2 and $3)::int as adm,
               count(*) filter (where datadem between $2 and $3)::int as dem
          from ativo group by grupo
      ) x)`;

  const [row] = await query<{ d: MegaRaw }>(
    `${cte}
     select json_build_object(
       'adm', (select count(*) filter (where dataadm between $2 and $3)::int from fbase),
       'dem', (select count(*) filter (where datadem between $2 and $3)::int from fbase),
       'ativos', (select count(*) filter (where at_fim)::int from ativo),
       'voluntarios', (select count(*) filter (where datadem between $2 and $3 and causa in (3,4,7,14))::int from fbase),
       'involuntarios', (select count(*) filter (where datadem between $2 and $3 and causa in (1,2,5,11,13))::int from fbase),
       'tempomedio', (select round(avg(datadem - dataadm) filter (where datadem between $2 and $3 and dataadm is not null))::int from fbase),
       'prevadm', (select count(*) filter (where dataadm between ${pIni} and ${pFim})::int from fbase),
       'prevdem', (select count(*) filter (where datadem between ${pIni} and ${pFim})::int from fbase),
       'prevativos', (select count(*) filter (where dataadm <= ${pFim} and (datadem is null or datadem >= ${pFim}))::int from fbase),
       'serie', (select coalesce(json_agg(s order by s.mes), '[]'::json) from (
           select to_char(m.ini, 'YYYY-MM-DD') as mes,
                  count(*) filter (where fb.dataadm between m.ini and m.fim)::int as adm,
                  count(*) filter (where fb.datadem between m.ini and m.fim)::int as dem,
                  count(*) filter (where fb.dataadm <= m.fim and (fb.datadem is null or fb.datadem >= m.fim))::int as ativos
             from (select gs::date as ini, (gs + interval '1 month' - interval '1 day')::date as fim
                     from generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), interval '1 month') gs) m
             left join fbase fb on true
            group by m.ini
         ) s),
       'organogramas', ${grupoAgg("setor")},
       'cargos', ${grupoAgg("cargo")},
       'estabs', ${grupoAgg("estab")},
       'sexo', ${grupoAgg("case when sexo=1 then 'Masculino' when sexo=2 then 'Feminino' else '(n/d)' end")},
       'idade', ${grupoAgg(EXPR_FAIXA_ETARIA)},
       'escolaridade', ${grupoAgg(EXPR_ESCOLARIDADE)},
       'estadocivil', ${grupoAgg(EXPR_ESTADOCIVIL)},
       'horarios', ${grupoAgg("horario")},
       'motivos', (select coalesce(json_agg(x order by x.valor desc), '[]'::json) from (
           select coalesce(descrcausa, '(não informado)') as rotulo, count(*)::int as valor
             from fbase where datadem between $2 and $3 group by rotulo
         ) x),
       'tenure', (select coalesce(json_agg(x order by x.ord), '[]'::json) from (
           select faixa as rotulo, ord, count(*)::int as valor from (
             select case
                      when (datadem - dataadm) < 90 then 'Menos de 3 meses'
                      when (datadem - dataadm) < 365 then '3 a 12 meses'
                      when (datadem - dataadm) < 1095 then '1 a 3 anos'
                      else 'Mais de 3 anos'
                    end as faixa,
                    case
                      when (datadem - dataadm) < 90 then 1
                      when (datadem - dataadm) < 365 then 2
                      when (datadem - dataadm) < 1095 then 3
                      else 4
                    end as ord
               from fbase where datadem between $2 and $3 and dataadm is not null
           ) t group by faixa, ord
         ) x)
     ) as d`,
    params
  );

  const d = row.d;
  return {
    consolidado: {
      admissoes: d.adm,
      desligamentos: d.dem,
      ativos: d.ativos,
      turnover: indice(d.adm, d.dem, d.ativos),
      saldo: d.adm - d.dem,
      voluntarios: d.voluntarios,
      involuntarios: d.involuntarios,
      tempoMedioCasaDias: d.tempomedio,
    },
    anterior: {
      turnover: indice(d.prevadm, d.prevdem, d.prevativos),
      admissoes: d.prevadm,
      desligamentos: d.prevdem,
      ativos: d.prevativos,
    },
    serie: d.serie.map(
      (r): TurnoverPonto => ({
        mes: r.mes,
        admissoes: r.adm,
        desligamentos: r.dem,
        ativos: r.ativos,
        turnover: indice(r.adm, r.dem, r.ativos),
      })
    ),
    organogramas: d.organogramas.map(paraGrupo),
    cargos: d.cargos.map(paraGrupo),
    estabelecimentos: d.estabs.map(paraGrupo),
    sexo: d.sexo.map(paraGrupo),
    faixaEtaria: d.idade.map(paraGrupo),
    escolaridade: d.escolaridade.map(paraGrupo),
    estadoCivil: d.estadocivil.map(paraGrupo),
    horarios: d.horarios.map(paraGrupo),
    motivos: d.motivos,
    tenure: d.tenure,
  };
}

interface MovRow {
  codigoempresa: number;
  contrato: number;
  nome: string;
  dataadm: string | null;
  datadem: string | null;
  cargo: string;
  setor: string;
  motivo: string | null;
  tempocasadias: number | null;
  admitido: boolean;
  desligado: boolean;
}

function paraMov(r: MovRow): FolhaMovimentacao {
  return {
    codigoempresa: r.codigoempresa,
    contrato: r.contrato,
    nome: r.nome,
    dataadm: r.dataadm,
    datadem: r.datadem,
    cargo: r.cargo,
    setor: r.setor,
    motivo: r.motivo,
    tempoCasaDias: r.tempocasadias,
    admitido: r.admitido,
    desligado: r.desligado,
  };
}

/** Admitidos/desligados no período (ou o efetivo no fim). Cada linha → ficha. */
export async function montarMovimentacoes(
  f: FiscalFilters,
  sel: FolhaFiltrosSel,
  efetivo: boolean,
  empresasForcadas?: number[]
): Promise<FolhaMovimentacao[]> {
  const { cte, params } = await construirBase(f, sel, true, empresasForcadas);
  const filtro = efetivo
    ? `dataadm <= $3 and (datadem is null or datadem >= $3)`
    : `dataadm between $2 and $3 or datadem between $2 and $3`;
  const ordem = efetivo ? "nome" : "coalesce(datadem, dataadm) desc, nome";

  const rows = await query<MovRow>(
    `${cte}
     select codigoempresa, codigofunccontr as contrato, nome,
            to_char(dataadm, 'YYYY-MM-DD') as dataadm,
            to_char(datadem, 'YYYY-MM-DD') as datadem,
            cargo, setor, descrcausa as motivo,
            case when dataadm is null then null
                 when datadem is not null then (datadem - dataadm)
                 else (current_date - dataadm) end as tempocasadias,
            (dataadm is not null and dataadm between $2 and $3) as admitido,
            (datadem is not null and datadem between $2 and $3) as desligado
       from fbase
      where ${filtro}
      order by ${ordem}`,
    params
  );
  return rows.map(paraMov);
}

/** Drill de uma quebra: as pessoas de um grupo (dim/valor) no período. */
export async function montarPessoas(
  f: FiscalFilters,
  sel: FolhaFiltrosSel,
  dim: string,
  valor: string,
  empresasForcadas?: number[]
): Promise<FolhaMovimentacao[]> {
  // Dimensões que já são filtro da base entram na seleção; a base recorta.
  if (dim === "setor") sel.setores = [...sel.setores, valor];
  else if (dim === "cargo") sel.cargos = [...sel.cargos, valor];
  else if (dim === "estab") sel.estabs = [...sel.estabs, valor];
  else if (dim === "vinculo") sel.vinculos = [...sel.vinculos, valor];
  else if (dim === "horario") sel.horarios = [...sel.horarios, valor];

  const { cte, params } = await construirBase(f, sel, true, empresasForcadas);

  const conds = ["(dataadm between $2 and $3 or datadem between $2 and $3)"];
  if (dim === "sexo") {
    params.push(sexoValor(valor));
    conds.push(`sexo = $${params.length}`);
  } else if (dim === "faixaEtaria") {
    params.push(valor);
    conds.push(`(${EXPR_FAIXA_ETARIA}) = $${params.length}`);
  } else if (dim === "escolaridade") {
    params.push(valor);
    conds.push(`(${EXPR_ESCOLARIDADE}) = $${params.length}`);
  } else if (dim === "estadoCivil") {
    params.push(valor);
    conds.push(`(${EXPR_ESTADOCIVIL}) = $${params.length}`);
  } else if (dim === "motivo") {
    params.push(valor);
    conds.push(`datadem between $2 and $3`);
    conds.push(`coalesce(descrcausa, '(não informado)') = $${params.length}`);
  } else if (dim === "tempoCasa") {
    params.push(valor);
    conds.push(`datadem between $2 and $3 and dataadm is not null`);
    conds.push(`(${EXPR_TENURE_FAIXA}) = $${params.length}`);
  }

  const rows = await query<MovRow>(
    `${cte}
     select codigoempresa, codigofunccontr as contrato, nome,
            to_char(dataadm, 'YYYY-MM-DD') as dataadm,
            to_char(datadem, 'YYYY-MM-DD') as datadem,
            cargo, setor, descrcausa as motivo,
            case when datadem is not null and dataadm is not null then (datadem - dataadm) end as tempocasadias,
            (dataadm is not null and dataadm between $2 and $3) as admitido,
            (datadem is not null and datadem between $2 and $3) as desligado
       from fbase
      where ${conds.join(" and ")}
      order by coalesce(datadem, dataadm) desc, nome`,
    params
  );
  return rows.map(paraMov);
}

/** Parse dos filtros da Rotatividade a partir da querystring (compartilhado). */
export function parseTurnoverReq(sp: URLSearchParams): { f: FiscalFilters; sel: FolhaFiltrosSel } {
  const f = parseFilters(sp);
  const sel = parseFolhaFiltrosSel(sp);
  return { f, sel };
}

export { FilterError };
