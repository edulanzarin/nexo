import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, FilterError } from "@/lib/fiscal-filters";
import type { ImpostosSerie, PontoImposto } from "@/lib/types";

/**
 * Evolução dos impostos no período (carga tributária no tempo).
 * Mesma granularidade da série de notas (dia até 92 dias, senão mês).
 * ICMS/ST/IPI/ISS vêm de lctofis*produto; PIS/COFINS de lctofis*piscofins.
 * As tabelas de item não têm coluna `cancelada` (canceladas são raras).
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "sai";
  if (tipo !== "ent" && tipo !== "sai") throw new FilterError("tipo deve ser ent ou sai");
  const sufixo = tipo === "ent" ? "ent" : "sai";

  const dias = (Date.parse(filters.fim) - Date.parse(filters.inicio)) / 86_400_000 + 1;
  const granularidade: ImpostosSerie["granularidade"] = dias > 92 ? "mes" : "dia";
  const bucketExpr =
    granularidade === "mes"
      ? `to_char(date_trunc('month', f.datalctofis), 'YYYY-MM-DD')`
      : `to_char(f.datalctofis, 'YYYY-MM-DD')`;

  const w = await buildWhere(
    { ...filters, especies: [] },
    { alias: "f", incluirCanceladas: true }
  );

  const [produto, piscofins] = await Promise.all([
    query<{ bucket: string; icms: number; st: number; ipi: number; iss: number }>(
      `select ${bucketExpr} as bucket,
              coalesce(sum(f.valoricms), 0)::float as icms,
              coalesce(sum(f.valorsubtribut), 0)::float as st,
              coalesce(sum(f.valoripi), 0)::float as ipi,
              coalesce(sum(f.valoriss), 0)::float as iss
         from lctofis${sufixo}produto f
        where ${w.sql}
        group by 1`,
      w.params
    ),
    query<{ bucket: string; pis: number; cofins: number }>(
      `select ${bucketExpr} as bucket,
              coalesce(sum(f.valorpis), 0)::float as pis,
              coalesce(sum(f.valorcofins), 0)::float as cofins
         from lctofis${sufixo}piscofins f
        where ${w.sql}
        group by 1`,
      w.params
    ),
  ]);

  const porBucket = new Map<string, PontoImposto>();
  const ponto = (bucket: string): PontoImposto => {
    let p = porBucket.get(bucket);
    if (!p) {
      p = { bucket, icms: 0, st: 0, ipi: 0, iss: 0, pis: 0, cofins: 0 };
      porBucket.set(bucket, p);
    }
    return p;
  };
  for (const r of produto) {
    const p = ponto(r.bucket);
    p.icms = r.icms;
    p.st = r.st;
    p.ipi = r.ipi;
    p.iss = r.iss;
  }
  for (const r of piscofins) {
    const p = ponto(r.bucket);
    p.pis = r.pis;
    p.cofins = r.cofins;
  }

  const pontos = [...porBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  return { granularidade, pontos } satisfies ImpostosSerie;
});
