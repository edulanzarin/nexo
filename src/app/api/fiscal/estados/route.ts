import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, FilterError } from "@/lib/fiscal-filters";
import type { EstadoResumo } from "@/lib/types";

/**
 * Distribuição por UF da contraparte (pessoa).
 * As colunas de UF do cabeçalho vêm mal preenchidas (só ~20% em saídas),
 * então usamos o estado da pessoa via join — cobertura muito maior.
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "sai";
  if (tipo !== "ent" && tipo !== "sai") throw new FilterError("tipo deve ser ent ou sai");
  const tabela = tipo === "ent" ? "lctofisent" : "lctofissai";

  const { sql, params } = await buildWhere(filters, { alias: "f" });
  const rows = await query<EstadoResumo>(
    `select coalesce(p.siglaestado, '—') as uf,
            e.nomeestado as nome,
            coalesce(sum(f.valorcontabil), 0)::float as valor,
            count(*)::int as qtd
       from ${tabela} f
       left join pessoa p on p.codigopessoa = f.codigopessoa
       left join estado e on e.siglaestado = p.siglaestado
      where ${sql}
      group by 1, 2
      order by valor desc`,
    params
  );
  return rows;
});
