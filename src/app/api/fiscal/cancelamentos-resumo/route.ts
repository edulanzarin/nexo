import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { CancelamentosResumo } from "@/lib/types";

/** Total e taxa de cancelamento por lado (cabeçalho, `cancelada='1'`). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const w = await buildWhere(filters, { alias: "f", incluirCanceladas: true });

  const lado = (t: "ent" | "sai") =>
    query<{ canceladas: number; total: number }>(
      `select count(*) filter (where f.cancelada = '1')::int as canceladas,
              count(*)::int as total
         from lctofis${t} f where ${w.sql}`,
      w.params
    );

  const [ent, sai] = await Promise.all([lado("ent"), lado("sai")]);
  return { ent: ent[0], sai: sai[0] } satisfies CancelamentosResumo;
});
