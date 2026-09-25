import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

/** Top municípios da contraparte (via pessoa → municipio). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const metrica = req.nextUrl.searchParams.get("metrica") === "qtd" ? "qtd" : "valor";
  const tabela = tipo === "ent" ? "lctofisent" : "lctofissai";
  const w = await buildWhere(filters, { alias: "f" });

  const rows = await query<TopItem>(
    `select coalesce(m.nomemunic, 'Sem município')::text as nome,
            max(p.siglaestado) as detalhe,
            coalesce(sum(f.valorcontabil), 0)::float as valor,
            count(*)::int as qtd,
            row_number() over () as codigo
       from ${tabela} f
       join pessoa p on p.codigopessoa = f.codigopessoa
       left join municipio m on m.codigomunic = p.codigomunic
                            and m.siglaestado = p.siglaestado
      where ${w.sql}
      group by m.nomemunic
      order by ${metrica} desc
      limit 12`,
    w.params
  );

  return rows.map((r) => ({
    codigo: r.codigo,
    nome: r.nome,
    valor: r.valor,
    qtd: r.qtd,
    detalhe: r.detalhe ? `${r.detalhe}` : null,
  }));
});
