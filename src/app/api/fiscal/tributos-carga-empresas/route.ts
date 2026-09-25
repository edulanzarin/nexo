import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { TributosCargaEmpresa } from "@/lib/types";

/** Carga tributária efetiva por empresa: (ICMS+IPI+ST+ISS) ÷ faturamento das saídas. */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const w = await buildWhere({ ...filters, especies: [] }, { alias: "f", incluirCanceladas: true });

  const rows = await query<{ codigo: number; nome: string; fat: number; trib: number }>(
    `with base as (
       select f.codigoempresa,
              coalesce(sum(f.valortotal), 0)::float as fat,
              coalesce(sum(f.valoricms + f.valoripi + f.valorsubtribut + f.valoriss), 0)::float as trib
         from lctofissaiproduto f
        where ${w.sql}
        group by f.codigoempresa
     )
     select b.codigoempresa as codigo,
            coalesce(e.nomeempresa, 'Empresa ' || b.codigoempresa) as nome,
            b.fat, b.trib
       from base b
       left join empresa e on e.codigoempresa = b.codigoempresa
      where b.fat > 0
      order by b.trib desc
      limit 15`,
    w.params
  );

  return rows.map<TributosCargaEmpresa>((r) => ({
    codigo: r.codigo,
    nome: r.nome,
    faturamento: r.fat,
    tributos: r.trib,
    carga: r.fat > 0 ? (r.trib / r.fat) * 100 : 0,
  }));
});
