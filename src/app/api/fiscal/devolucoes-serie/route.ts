import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { PontoValorSerie } from "@/lib/types";

/** Valor devolvido ao longo do período (dia/mês). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const dias = (Date.parse(filters.fim) - Date.parse(filters.inicio)) / 86_400_000 + 1;
  const granularidade: PontoValorSerie["granularidade"] = dias > 92 ? "mes" : "dia";
  const bucketExpr =
    granularidade === "mes"
      ? `to_char(date_trunc('month', f.datalctofis), 'YYYY-MM-DD')`
      : `to_char(f.datalctofis, 'YYYY-MM-DD')`;
  const w = await buildWhere({ ...filters, especies: [] }, { alias: "f", incluirCanceladas: true });

  const pontos = await query<{ bucket: string; valor: number }>(
    `select ${bucketExpr} as bucket,
            coalesce(sum(f.valortotal), 0)::float as valor
       from lctofis${tipo}produto f
       join cfop cf on cf.codigoempresa = f.codigoempresa
                   and cf.codigoestab = f.codigoestab
                   and cf.codigocfop = f.codigocfop
      where ${w.sql} and cf.descrcfop ilike '%devolu%'
      group by 1
      order by 1`,
    w.params
  );

  return { granularidade, pontos } satisfies PontoValorSerie;
});
