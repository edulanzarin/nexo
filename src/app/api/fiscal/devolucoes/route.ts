import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, FilterError } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

/**
 * Devoluções identificadas pelo CFOP (descrição contém "devolu").
 * Retorna os top CFOPs de devolução no formato TopItem (para reusar o gráfico).
 * Devolução de venda entra como nota de entrada; de compra sai como saída.
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "sai";
  if (tipo !== "ent" && tipo !== "sai") throw new FilterError("tipo deve ser ent ou sai");
  const metrica = req.nextUrl.searchParams.get("metrica") === "qtd" ? "qtd" : "valor";
  const tabela = tipo === "ent" ? "lctofisentproduto" : "lctofissaiproduto";
  const chave = tipo === "ent" ? "chavelctofisent" : "chavelctofissai";

  const { sql, params } = await buildWhere(
    { ...filters, especies: [] },
    { alias: "f", incluirCanceladas: true }
  );

  const rows = await query<TopItem>(
    `select f.codigocfop as codigo,
            max(cf.descrcfop) as nome,
            coalesce(sum(f.valortotal), 0)::float as valor,
            count(distinct f.${chave})::int as qtd
       from ${tabela} f
       join cfop cf on cf.codigoempresa = f.codigoempresa
                   and cf.codigoestab = f.codigoestab
                   and cf.codigocfop = f.codigocfop
      where ${sql}
        and cf.descrcfop ilike '%devolu%'
      group by f.codigocfop
      order by ${metrica} desc
      limit 8`,
    params
  );

  return rows.map((r) => ({
    codigo: r.codigo,
    nome: `${r.codigo} · ${r.nome}`,
    valor: r.valor,
    qtd: r.qtd,
    detalhe: null,
  }));
});
