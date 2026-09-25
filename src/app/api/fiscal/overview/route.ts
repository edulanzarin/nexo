import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, periodoAnterior } from "@/lib/fiscal-filters";
import type { Overview, LadoResumo } from "@/lib/types";

interface AtualRow {
  valor: number;
  qtd: number;
  canceladas: number;
}

interface AnteriorRow {
  valor: number;
  qtd: number;
}

async function lado(
  tabela: "lctofisent" | "lctofissai",
  filters: ReturnType<typeof parseFilters>
): Promise<LadoResumo> {
  const atual = await buildWhere(filters, { incluirCanceladas: true });
  const anterior = await buildWhere(periodoAnterior(filters));

  const [[a], [p]] = await Promise.all([
    query<AtualRow>(
      `select coalesce(sum(valorcontabil) filter (where cancelada <> '1'), 0)::float as valor,
              count(*) filter (where cancelada <> '1')::int as qtd,
              count(*) filter (where cancelada = '1')::int as canceladas
         from ${tabela}
        where ${atual.sql}`,
      atual.params
    ),
    query<AnteriorRow>(
      `select coalesce(sum(valorcontabil), 0)::float as valor, count(*)::int as qtd
         from ${tabela}
        where ${anterior.sql}`,
      anterior.params
    ),
  ]);

  return {
    valor: a.valor,
    qtd: a.qtd,
    canceladas: a.canceladas,
    valorAnterior: p.valor,
    qtdAnterior: p.qtd,
  };
}

async function empresasComMovimento(
  filters: ReturnType<typeof parseFilters>
): Promise<number> {
  const w = await buildWhere(filters);
  const [r] = await query<{ n: number }>(
    `select count(distinct codigoempresa)::int as n
       from (select codigoempresa from lctofisent where ${w.sql}
             union all
             select codigoempresa from lctofissai where ${w.sql}) t`,
    w.params
  );
  return r.n;
}

export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const [entradas, saidas, empresasAtivas, empresasAtivasAnterior] = await Promise.all([
    lado("lctofisent", filters),
    lado("lctofissai", filters),
    empresasComMovimento(filters),
    empresasComMovimento(periodoAnterior(filters)),
  ]);
  return { entradas, saidas, empresasAtivas, empresasAtivasAnterior } satisfies Overview;
});
