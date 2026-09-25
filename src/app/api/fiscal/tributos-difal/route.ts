import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

/** DIFAL + FCP a recolher por UF de destino (só saídas interestaduais). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const w = await buildWhere({ ...filters, especies: [] }, { alias: "f", incluirCanceladas: true });

  const rows = await query<{ uf: string; nome: string | null; valor: number; qtd: number }>(
    `select f.siglaestadodest as uf, e.nomeestado as nome,
            coalesce(sum(f.vlricmsintufdest + f.vlricmsfcpufdest), 0)::float as valor,
            count(*)::int as qtd
       from lctofissaidifal f
       left join estado e on e.siglaestado = f.siglaestadodest
      where ${w.sql} and f.siglaestadodest is not null and btrim(f.siglaestadodest) <> ''
      group by 1, 2
      order by valor desc
      limit 20`,
    w.params
  );

  return rows.map<TopItem>((r, i) => ({
    codigo: i,
    nome: r.uf,
    valor: r.valor,
    qtd: r.qtd,
    detalhe: r.nome,
  }));
});
