import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";

// Rótulos best-effort dos códigos de origem do dado no Questor.
const ORIGEM: Record<number, string> = {
  1: "Manual (digitado)",
  2: "Importado",
  3: "Integração / e-Doc (automático)",
};

/** Distribuição das notas por origem do dado (origemdado). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const metrica = req.nextUrl.searchParams.get("metrica") === "qtd" ? "qtd" : "valor";
  const tabela = tipo === "ent" ? "lctofisent" : "lctofissai";
  const w = await buildWhere(filters, { alias: "f", incluirCanceladas: true });

  const rows = await query<{ origem: number | null; valor: number; qtd: number }>(
    `select f.origemdado as origem,
            coalesce(sum(f.valorcontabil), 0)::float as valor,
            count(*)::int as qtd
       from ${tabela} f
      where ${w.sql}
      group by f.origemdado
      order by ${metrica} desc`,
    w.params
  );

  return rows.map((r) => ({
    codigo: r.origem ?? -1,
    nome: r.origem != null ? (ORIGEM[r.origem] ?? `Origem ${r.origem}`) : "Não informado",
    valor: r.valor,
    qtd: r.qtd,
    detalhe: null,
  }));
});
