import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, FilterError } from "@/lib/fiscal-filters";
import type { CfopResumo } from "@/lib/types";

/** A descrição do CFOP é a mesma em qualquer empresa/estab — pegamos uma amostra. */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "sai";
  if (tipo !== "ent" && tipo !== "sai") throw new FilterError("tipo deve ser ent ou sai");
  const ordem = req.nextUrl.searchParams.get("metrica") === "qtd" ? "itens" : "valor";
  const tabela = tipo === "ent" ? "lctofisentproduto" : "lctofissaiproduto";

  const { sql, params } = await buildWhere(
    { ...filters, especies: [] },
    { alias: "f", incluirCanceladas: true }
  );

  const rows = await query<CfopResumo>(
    `with agg as (
       select f.codigocfop,
              sum(f.valortotal)::float as valor,
              count(*)::int as itens
         from ${tabela} f
        where ${sql}
        group by f.codigocfop
        order by ${ordem} desc
        limit 12
     )
     select a.codigocfop as cfop,
            (select descrcfop from cfop c where c.codigocfop = a.codigocfop limit 1) as descricao,
            a.valor,
            a.itens
       from agg a
      order by a.${ordem} desc`,
    params
  );
  return rows;
});
