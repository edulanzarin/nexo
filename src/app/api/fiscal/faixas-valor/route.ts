import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

const FAIXAS = [
  "Até R$ 100",
  "R$ 100 – 500",
  "R$ 500 – 1 mil",
  "R$ 1 mil – 5 mil",
  "R$ 5 mil – 20 mil",
  "Acima de R$ 20 mil",
];

/** Distribuição das notas por faixa de valor contábil. */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const tabela = tipo === "ent" ? "lctofisent" : "lctofissai";
  const w = await buildWhere(filters, { alias: "f" });

  const rows = await query<{ idx: number; qtd: number; valor: number }>(
    `select case
              when f.valorcontabil < 100 then 0
              when f.valorcontabil < 500 then 1
              when f.valorcontabil < 1000 then 2
              when f.valorcontabil < 5000 then 3
              when f.valorcontabil < 20000 then 4
              else 5
            end as idx,
            count(*)::int as qtd,
            coalesce(sum(f.valorcontabil), 0)::float as valor
       from ${tabela} f
      where ${w.sql}
      group by 1`,
    w.params
  );

  const porIdx = new Map(rows.map((r) => [r.idx, r]));
  // devolve as 6 faixas em ordem, preenchendo as vazias com zero
  return FAIXAS.map((nome, idx): TopItem => {
    const r = porIdx.get(idx);
    return { codigo: idx, nome, valor: r?.valor ?? 0, qtd: r?.qtd ?? 0, detalhe: null };
  });
});
