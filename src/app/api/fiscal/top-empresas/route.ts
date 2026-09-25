import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, FilterError } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "sai";
  if (tipo !== "ent" && tipo !== "sai") throw new FilterError("tipo deve ser ent ou sai");
  const metrica = req.nextUrl.searchParams.get("metrica") === "qtd" ? "qtd" : "valor";
  const tabela = tipo === "ent" ? "lctofisent" : "lctofissai";

  const { sql, params } = await buildWhere(filters, { alias: "f" });
  const rows = await query<TopItem>(
    `select f.codigoempresa as codigo,
            coalesce(max(e.nomeempresa), 'Empresa ' || f.codigoempresa) as nome,
            coalesce(sum(f.valorcontabil), 0)::float as valor,
            count(*)::int as qtd
       from ${tabela} f
       left join empresa e on e.codigoempresa = f.codigoempresa
      where ${sql}
      group by f.codigoempresa
      order by ${metrica} desc
      limit 10`,
    params
  );
  return rows;
});
