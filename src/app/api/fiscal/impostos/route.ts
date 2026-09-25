import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere, FilterError } from "@/lib/fiscal-filters";
import type { Impostos } from "@/lib/types";

/**
 * Impostos do período. No Questor os valores ficam espalhados:
 * - ICMS/IPI/ST/ISS por item em lctofis*produto
 * - PIS/COFINS em lctofis*piscofins
 * - Retenções (IRRF/INSS/CSLL/ISSQN) em lctofis*retido (notas de serviço)
 * Somamos cada fonte em paralelo. As tabelas de item/imposto não têm coluna
 * `cancelada`, então incluem canceladas (raras).
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "sai";
  if (tipo !== "ent" && tipo !== "sai") throw new FilterError("tipo deve ser ent ou sai");
  const sufixo = tipo === "ent" ? "ent" : "sai";

  const semEspecie = { ...filters, especies: [] };
  const w = await buildWhere(semEspecie, { alias: "f", incluirCanceladas: true });

  // DIFAL/FCP/FUNRURAL só existem nas saídas
  const difalQ =
    tipo === "sai"
      ? query<{ difal: number; fcp: number }>(
          `select coalesce(sum(f.vlricmsintufdest), 0)::float as difal,
                  coalesce(sum(f.vlricmsfcpufdest), 0)::float as fcp
             from lctofissaidifal f where ${w.sql}`,
          w.params
        )
      : Promise.resolve([{ difal: 0, fcp: 0 }]);
  const funruralQ =
    tipo === "sai"
      ? query<{ funrural: number }>(
          `select coalesce(sum(f.valorfunrural), 0)::float as funrural
             from lctofissaifunrural f where ${w.sql}`,
          w.params
        )
      : Promise.resolve([{ funrural: 0 }]);

  const [produto, piscofins, retido, difal, funrural] = await Promise.all([
    query<{ icms: number; ipi: number; st: number; iss: number; total: number }>(
      `select coalesce(sum(f.valoricms), 0)::float as icms,
              coalesce(sum(f.valoripi), 0)::float as ipi,
              coalesce(sum(f.valorsubtribut), 0)::float as st,
              coalesce(sum(f.valoriss), 0)::float as iss,
              coalesce(sum(f.valortotal), 0)::float as total
         from lctofis${sufixo}produto f
        where ${w.sql}`,
      w.params
    ),
    query<{ pis: number; cofins: number }>(
      `select coalesce(sum(f.valorpis), 0)::float as pis,
              coalesce(sum(f.valorcofins), 0)::float as cofins
         from lctofis${sufixo}piscofins f
        where ${w.sql}`,
      w.params
    ),
    query<{ irrf: number; inss: number; csll: number; issqn: number }>(
      `select coalesce(sum(f.valorirrf), 0)::float as irrf,
              coalesce(sum(f.valorinss), 0)::float as inss,
              coalesce(sum(f.valorcsll), 0)::float as csll,
              coalesce(sum(f.valorissqn), 0)::float as issqn
         from lctofis${sufixo}retido f
        where ${w.sql}`,
      w.params
    ),
    difalQ,
    funruralQ,
  ]);

  return {
    icms: produto[0].icms,
    ipi: produto[0].ipi,
    st: produto[0].st,
    iss: produto[0].iss,
    pis: piscofins[0].pis,
    cofins: piscofins[0].cofins,
    irrf: retido[0].irrf,
    inss: retido[0].inss,
    csll: retido[0].csll,
    issqn: retido[0].issqn,
    difal: difal[0].difal,
    fcp: difal[0].fcp,
    funrural: funrural[0].funrural,
    totalItens: produto[0].total,
  } satisfies Impostos;
});
