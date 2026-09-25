import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { Timeseries, PontoSerie } from "@/lib/types";

interface BucketRow {
  bucket: string;
  valor: number;
  qtd: number;
}

export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const dias =
    (Date.parse(filters.fim) - Date.parse(filters.inicio)) / 86_400_000 + 1;
  const granularidade: Timeseries["granularidade"] = dias > 92 ? "mes" : "dia";
  const bucketExpr =
    granularidade === "mes"
      ? `to_char(date_trunc('month', datalctofis), 'YYYY-MM-DD')`
      : `to_char(datalctofis, 'YYYY-MM-DD')`;

  const { sql, params } = await buildWhere(filters);
  const serie = (tabela: string) =>
    query<BucketRow>(
      `select ${bucketExpr} as bucket,
              coalesce(sum(valorcontabil), 0)::float as valor,
              count(*)::int as qtd
         from ${tabela}
        where ${sql}
        group by 1
        order by 1`,
      params
    );

  const [ent, sai] = await Promise.all([serie("lctofisent"), serie("lctofissai")]);

  const porBucket = new Map<string, PontoSerie>();
  const ponto = (bucket: string): PontoSerie => {
    let p = porBucket.get(bucket);
    if (!p) {
      p = { bucket, entradas: 0, saidas: 0, qtdEntradas: 0, qtdSaidas: 0 };
      porBucket.set(bucket, p);
    }
    return p;
  };
  for (const r of ent) {
    const p = ponto(r.bucket);
    p.entradas = r.valor;
    p.qtdEntradas = r.qtd;
  }
  for (const r of sai) {
    const p = ponto(r.bucket);
    p.saidas = r.valor;
    p.qtdSaidas = r.qtd;
  }

  const pontos = [...porBucket.values()].sort((a, b) =>
    a.bucket.localeCompare(b.bucket)
  );
  return { granularidade, pontos } satisfies Timeseries;
});
