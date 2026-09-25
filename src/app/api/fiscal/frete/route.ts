import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";

const MODALIDADE: Record<number, string> = {
  0: "Por conta do emitente (CIF)",
  1: "Por conta do destinatário (FOB)",
  2: "Por conta de terceiros",
  3: "Transporte próprio (remetente)",
  4: "Transporte próprio (destinatário)",
  9: "Sem frete",
};

/** Distribuição das notas por modalidade de frete. */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const metrica = req.nextUrl.searchParams.get("metrica") === "qtd" ? "qtd" : "valor";
  const tabela = tipo === "ent" ? "lctofisent" : "lctofissai";
  const w = await buildWhere(filters, { alias: "f" });

  const rows = await query<{ modalidade: number | null; valor: number; qtd: number }>(
    `select f.modalidadefrete as modalidade,
            coalesce(sum(f.valorcontabil), 0)::float as valor,
            count(*)::int as qtd
       from ${tabela} f
      where ${w.sql}
      group by f.modalidadefrete
      order by ${metrica} desc`,
    w.params
  );

  return rows.map((r) => ({
    codigo: r.modalidade ?? -1,
    nome: r.modalidade != null ? (MODALIDADE[r.modalidade] ?? `Modalidade ${r.modalidade}`) : "Não informado",
    valor: r.valor,
    qtd: r.qtd,
    detalhe: null,
  }));
});
