import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { construirBase, rotuloVinculo } from "@/lib/folha-turnover";
import type { FolhaFiltros, FolhaOpcao } from "@/lib/types";

interface OpcaoRaw {
  valor: string;
  contratos: number;
}

/**
 * Opções dos filtros da Folha para a empresa selecionada — estabelecimentos,
 * setores, cargos e vínculos, cada um com a contagem de contratos. Sempre sem os
 * filtros avançados aplicados (a lista de opções não pode encolher conforme a
 * seleção). Alimenta os dropdowns da tela de Rotatividade.
 */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length === 0) {
    throw new FilterError("Selecione a empresa");
  }
  // Sem filtros avançados (fbase == base) e sem período (não usa datas).
  const { cte, params } = await construirBase(
    f,
    { estabs: [], setores: [], cargos: [], vinculos: [], horarios: [] },
    false
  );

  const [row] = await query<{
    estabs: OpcaoRaw[];
    setores: OpcaoRaw[];
    cargos: OpcaoRaw[];
    vinculos: OpcaoRaw[];
    horarios: OpcaoRaw[];
  }>(
    `${cte}
     select
       (select coalesce(json_agg(x order by x.contratos desc, x.valor), '[]'::json) from (
          select estab as valor, count(*)::int as contratos from base group by estab) x) as estabs,
       (select coalesce(json_agg(x order by x.contratos desc, x.valor), '[]'::json) from (
          select setor as valor, count(*)::int as contratos from base group by setor) x) as setores,
       (select coalesce(json_agg(x order by x.contratos desc, x.valor), '[]'::json) from (
          select cargo as valor, count(*)::int as contratos from base group by cargo) x) as cargos,
       (select coalesce(json_agg(x order by x.contratos desc, x.valor), '[]'::json) from (
          select vinc as valor, count(*)::int as contratos from base group by vinc) x) as vinculos,
       (select coalesce(json_agg(x order by x.contratos desc, x.valor), '[]'::json) from (
          select horario as valor, count(*)::int as contratos from base group by horario) x) as horarios`,
    params
  );

  const simples = (o: OpcaoRaw): FolhaOpcao => ({
    valor: o.valor,
    rotulo: o.valor,
    contratos: o.contratos,
  });

  const resp: FolhaFiltros = {
    estabelecimentos: row.estabs.map(simples),
    setores: row.setores.map(simples),
    cargos: row.cargos.map(simples),
    vinculos: row.vinculos.map((o) => ({
      valor: o.valor,
      rotulo: rotuloVinculo(o.valor),
      contratos: o.contratos,
    })),
    horarios: row.horarios.map(simples),
  };
  return resp;
});
