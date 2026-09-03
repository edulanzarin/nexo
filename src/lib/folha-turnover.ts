import type { FiscalFilters } from "./fiscal-filters";
import { getSessaoOpcional, empresasPermitidas } from "./sessao";

/**
 * A base da rotatividade: a view `funcionario` (ficha atual por contrato) já traz
 * datas, vínculo, sexo, nascimento, cargo, setor e salário; aqui só ligamos os
 * nomes (organograma, cargo, estab) e a causa da rescisão, e aplicamos os filtros
 * avançados. Três rotas (turnover, filtros, movimentações) partem desta mesma
 * base — DRY. Ver [[Módulo de folha e eSocial do Questor]].
 *
 * "Horário" sai do `descrtipojornada` (a jornada do `funcescala`, que a view já
 * resolve pela vigência) porque é ali que o DP escreve o turno — "1º turno", "2º
 * turno". O `escala.descrescala` (o horário cru, "13:30 às 17:30/18:00 às 22:00")
 * fica de reserva para a empresa que não preencheu a jornada: quem já enxergava
 * o horário continua enxergando, e quem escreveu turno passa a agrupar por turno.
 */
export interface FolhaFiltrosSel {
  estabs: string[];
  setores: string[];
  cargos: string[];
  vinculos: string[];
  horarios: string[];
}

export function parseFolhaFiltrosSel(sp: URLSearchParams): FolhaFiltrosSel {
  return {
    estabs: sp.getAll("estabs"),
    setores: sp.getAll("setores"),
    cargos: sp.getAll("cargos"),
    vinculos: sp.getAll("vinculos"),
    horarios: sp.getAll("horarios"),
  };
}

/**
 * Monta os CTEs da rotatividade a partir da view `funcionario`, aplicando os
 * filtros avançados. Sempre gera `base` (empresa) e `fbase` (com filtros); com
 * `incluirPeriodo` (turnover/movimentações) também gera `ativo` (flag "ativo no
 * fim") e reserva $2 início / $3 fim — os filtros vêm depois. Sem período
 * (filtros), não passa data: $2+ são só os filtros, e o Postgres não reclama de
 * parâmetro de data sem uso.
 */
export async function construirBase(
  f: FiscalFilters,
  sel: FolhaFiltrosSel,
  incluirPeriodo = true,
  empresasForcadas?: number[]
): Promise<{ cte: string; params: unknown[] }> {
  // Escopo de empresa aplicado aqui (mesmo funil da Folha que o buildWhere é do
  // Fiscal/Contábil): "todas" usa o que o cliente pediu; senão limita ao
  // permitido (interseção), e vazio não casa nenhuma empresa.
  //
  // `empresasForcadas` pula o escopo da sessão: é o RH, cujo dado é fixo nas
  // empresas do RH — NAVECON/FOUR/FINAVE (o gate é o módulo, não o grupo de
  // empresas — o grupo padrão até esconde a NAVECON). O chamador já garantiu o acesso.
  let empresas: number[];
  if (empresasForcadas) {
    empresas = empresasForcadas;
  } else {
    const sessao = await getSessaoOpcional();
    const escopo: number[] | "todas" = sessao ? empresasPermitidas(sessao) : [];
    empresas =
      escopo === "todas"
        ? f.empresas
        : f.empresas.length > 0
          ? f.empresas.filter((e) => escopo.includes(e))
          : escopo;
  }
  const params: unknown[] = incluirPeriodo
    ? [empresas, f.inicio, f.fim]
    : [empresas];
  const conds: string[] = [];
  const add = (arr: string[], col: string) => {
    if (arr.length > 0) {
      params.push(arr);
      conds.push(`${col} = any($${params.length}::text[])`);
    }
  };
  add(sel.estabs, "estab");
  add(sel.setores, "setor");
  add(sel.cargos, "cargo");
  add(sel.vinculos, "vinc");
  add(sel.horarios, "horario");
  const filtro = conds.length > 0 ? `where ${conds.join(" and ")}` : "";

  const ativo = incluirPeriodo
    ? `, ativo as (select *, (dataadm <= $3 and (datadem is null or datadem >= $3)) as at_fim from fbase)`
    : "";

  const cte = `
    with base as (
      select f.codigoempresa, f.codigofunccontr, f.dataadm, f.datadem,
             f.nomefunc as nome, f.sexo, f.datanasc, f.grauinstr, f.estadocivil,
             f.categoria, f.tipovinculo,
             coalesce(f.categoria, '') || '|' || coalesce(f.tipovinculo, '') as vinc,
             coalesce(nullif(btrim(o.descrorgan), ''), '(sem setor)') as setor,
             coalesce(nullif(btrim(ca.descrcargo), ''), '(sem cargo)') as cargo,
             coalesce(nullif(btrim(es.apelidoestab), ''), nullif(btrim(es.nomeestab), ''), '(sem estab)') as estab,
             coalesce(nullif(btrim(f.descrtipojornada), ''),
                      nullif(btrim(esc.descrescala), ''), '(sem horário)') as horario,
             rr.codigocausa as causa, cd.descrcausa
        from funcionario f
        left join organograma o
          on o.codigoempresa = f.codigoempresa and o.codigoestab = f.codigoestab and o.classiforgan = f.classiforgan
        left join cargo ca on ca.codigocargo = f.codigocargo
        left join estab es on es.codigoempresa = f.codigoempresa and es.codigoestab = f.codigoestab
        left join escala esc on esc.codigoescala = f.codigoescala
        left join lateral (
          select codigocausa from rescisao r
           where r.codigoempresa = f.codigoempresa and r.codigofunccontr = f.codigofunccontr
           order by complementar limit 1
        ) rr on true
        left join causademissao cd on cd.codigocausa = rr.codigocausa
       where f.codigoempresa = any($1::int[])
    ),
    fbase as (select * from base ${filtro})${ativo}
  `;
  return { cte, params };
}

/**
 * Expressão SQL da faixa etária (usa $3 = fim do período como referência da
 * idade). Compartilhada pela quebra e pelo drill, para o rótulo bater exato.
 */
export const EXPR_FAIXA_ETARIA = `case
    when datanasc is null then '(n/d)'
    when extract(year from age($3::date, datanasc)) < 25 then 'Até 24 anos'
    when extract(year from age($3::date, datanasc)) < 35 then '25 a 34 anos'
    when extract(year from age($3::date, datanasc)) < 45 then '35 a 44 anos'
    when extract(year from age($3::date, datanasc)) < 55 then '45 a 54 anos'
    else '55 anos ou mais'
  end`;

/** Expressão SQL da faixa de tempo de casa (só faz sentido para desligados). */
export const EXPR_TENURE_FAIXA = `case
    when (datadem - dataadm) < 90 then 'Menos de 3 meses'
    when (datadem - dataadm) < 365 then '3 a 12 meses'
    when (datadem - dataadm) < 1095 then '1 a 3 anos'
    else 'Mais de 3 anos'
  end`;

/** Sexo (smallint) → rótulo. */
export function sexoValor(rotulo: string): number {
  return rotulo === "Masculino" ? 1 : rotulo === "Feminino" ? 2 : -1;
}

/** Escolaridade (grauinstr, eSocial tabela 18) como expressão SQL. */
export const EXPR_ESCOLARIDADE = `case coalesce(grauinstr, 0)
    when 1 then 'Analfabeto'
    when 2 then 'Até o 5º ano incompleto'
    when 3 then '5º ano completo'
    when 4 then '6º ao 9º ano incompleto'
    when 5 then 'Fundamental completo'
    when 6 then 'Médio incompleto'
    when 7 then 'Médio completo'
    when 8 then 'Superior incompleto'
    when 9 then 'Superior completo'
    when 10 then 'Pós-graduação'
    when 11 then 'Mestrado'
    when 12 then 'Doutorado'
    else '(n/d)'
  end`;

/** Estado civil (smallint) como expressão SQL. */
export const EXPR_ESTADOCIVIL = `case coalesce(estadocivil, 0)
    when 1 then 'Solteiro(a)'
    when 2 then 'Casado(a)'
    when 3 then 'Divorciado(a)'
    when 4 then 'Separado(a)'
    when 5 then 'Viúvo(a)'
    when 6 then 'União estável'
    else '(n/d)'
  end`;

/** Rótulo amigável do vínculo (categoria|tipovinculo). Sem tabela de domínio na
 *  base, mapeia só o certo (CLT) e mostra o resto cru — honesto. */
export function rotuloVinculo(vinc: string): string {
  const [categoria, tipo] = vinc.split("|");
  if (categoria === "01" && tipo === "10") return "Empregado (CLT)";
  if (categoria === "01") return `Empregado · tipo ${tipo || "?"}`;
  return `Categoria ${categoria || "?"} · tipo ${tipo || "?"}`;
}

/** eSocial tabela 18 — grau de instrução. */
const ESCOLARIDADE: Record<number, string> = {
  1: "Analfabeto",
  2: "Até o 5º ano incompleto",
  3: "5º ano completo",
  4: "6º ao 9º ano incompleto",
  5: "Fundamental completo",
  6: "Médio incompleto",
  7: "Médio completo",
  8: "Superior incompleto",
  9: "Superior completo",
  10: "Pós-graduação",
  11: "Mestrado",
  12: "Doutorado",
};

export function rotuloEscolaridade(grau: number | null): string | null {
  if (grau == null) return null;
  return ESCOLARIDADE[grau] ?? `Grau ${grau}`;
}
