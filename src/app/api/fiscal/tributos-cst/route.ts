import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

// CST do PIS/COFINS (Tabela 4.3.3) — rótulos das principais situações.
const CST_PIS: Record<number, string> = {
  1: "Tributável (alíq. normal)",
  2: "Tributável (alíq. diferenciada)",
  3: "Tributável (por quantidade)",
  4: "Monofásico (alíq. zero)",
  5: "Substituição tributária",
  6: "Alíquota zero",
  7: "Isenta",
  8: "Sem incidência",
  9: "Suspensão",
  49: "Outras saídas",
  99: "Outras",
};

/** Distribuição das saídas por CST de PIS/COFINS (tributado × desonerado). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const w = await buildWhere({ ...filters, especies: [] }, { alias: "f", incluirCanceladas: true });

  const rows = await query<{ cst: number | null; itens: number; pis: number }>(
    `select f.cdsituatributpis as cst, count(*)::int as itens,
            coalesce(sum(f.valorpis), 0)::float as pis
       from lctofissaipiscofins f
      where ${w.sql}
      group by 1
      order by 2 desc`,
    w.params
  );

  return rows.map<TopItem>((r) => ({
    codigo: r.cst ?? -1,
    nome: r.cst != null ? `${String(r.cst).padStart(2, "0")} · ${CST_PIS[r.cst] ?? "CST " + r.cst}` : "Não informado",
    valor: r.pis,
    qtd: r.itens,
    detalhe: null,
  }));
});
