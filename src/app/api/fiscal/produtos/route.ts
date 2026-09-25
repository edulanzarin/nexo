import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, FilterError } from "@/lib/fiscal-filters";
import type { ProdutoTop } from "@/lib/types";

/**
 * Top produtos a partir das tabelas de item (lctofis*produto).
 * Agrega primeiro e só junta produto/empresa nos 10 vencedores — evita
 * tocar as tabelas de 2,8M produtos e 1465 empresas em cada linha.
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "sai";
  if (tipo !== "ent" && tipo !== "sai") throw new FilterError("tipo deve ser ent ou sai");
  const metrica = req.nextUrl.searchParams.get("metrica") === "qtd" ? "qtd" : "valor";
  const tabela = tipo === "ent" ? "lctofisentproduto" : "lctofissaiproduto";

  // As tabelas de item não têm 'cancelada'; o filtro replica só datas/empresas/espécie
  // não se aplica aqui (espécie é do cabeçalho), então usamos apenas datas e empresas.
  const { sql, params } = await buildWhere(
    { ...filters, especies: [] },
    { alias: "f", incluirCanceladas: true }
  );

  const rows = await query<ProdutoTop>(
    `with topn as (
       select f.codigoempresa,
              f.codigoproduto,
              sum(f.valortotal)::float as valor,
              sum(f.quantidade)::float as qtd
         from ${tabela} f
        where ${sql}
        group by f.codigoempresa, f.codigoproduto
        order by ${metrica} desc
        limit 10
     )
     select t.codigoempresa as "codigoEmpresa",
            t.codigoproduto as "codigoProduto",
            p.descrproduto as descricao,
            p.unidademedida as unidade,
            e.nomeempresa as "nomeEmpresa",
            t.valor,
            t.qtd
       from topn t
       left join produto p
         on p.codigoempresa = t.codigoempresa and p.codigoproduto = t.codigoproduto
       left join empresa e on e.codigoempresa = t.codigoempresa
      order by t.${metrica} desc`,
    params
  );
  return rows;
});
