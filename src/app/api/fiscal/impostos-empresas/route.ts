import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

/** Top empresas por total de tributos de item (ICMS+IPI+ST+ISS). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const w = await buildWhere({ ...filters, especies: [] }, { alias: "f", incluirCanceladas: true });

  const rows = await query<TopItem>(
    `with topn as (
       select f.codigoempresa,
              coalesce(sum(f.valoricms + f.valoripi + f.valorsubtribut + f.valoriss), 0)::float as valor
         from lctofis${tipo}produto f
        where ${w.sql}
        group by f.codigoempresa
        order by valor desc
        limit 10
     )
     select t.codigoempresa as codigo,
            coalesce(e.nomeempresa, 'Empresa ' || t.codigoempresa) as nome,
            t.valor, t.valor as qtd
       from topn t
       left join empresa e on e.codigoempresa = t.codigoempresa
      order by t.valor desc`,
    w.params
  );

  return rows.map((r) => ({ ...r, detalhe: null }));
});
