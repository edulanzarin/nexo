import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";

/**
 * Ranking de canceladas por empresa (por=empresa) ou por espécie (por=especie).
 * Valor e qtd = contagem de notas canceladas.
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const por = req.nextUrl.searchParams.get("por") === "especie" ? "especie" : "empresa";
  const tabela = tipo === "ent" ? "lctofisent" : "lctofissai";
  const w = await buildWhere(filters, { alias: "f", incluirCanceladas: true });

  const sql =
    por === "empresa"
      ? `select f.codigoempresa as codigo,
                coalesce(max(e.nomeempresa), 'Empresa ' || f.codigoempresa) as nome,
                count(*)::int as qtd
           from ${tabela} f
           left join empresa e on e.codigoempresa = f.codigoempresa
          where ${w.sql} and f.cancelada = '1'
          group by f.codigoempresa
          order by qtd desc
          limit 10`
      : `select 0 as codigo,
                upper(btrim(f.especienf)) as nome,
                count(*)::int as qtd
           from ${tabela} f
          where ${w.sql} and f.cancelada = '1'
          group by upper(btrim(f.especienf))
          order by qtd desc
          limit 10`;

  const rows = await query<{ codigo: number; nome: string; qtd: number }>(sql, w.params);
  return rows.map((r) => ({ codigo: r.codigo, nome: r.nome, valor: r.qtd, qtd: r.qtd, detalhe: null }));
});
