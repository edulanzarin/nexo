import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { DevolucoesResumo, LadoQtdValor } from "@/lib/types";

/**
 * Resumo de devoluções: valor e qtd devolvidos por lado + faturamento (base p/ %).
 * Devolução = item com CFOP cuja descrição contém "devolu". Venda devolvida entra
 * como entrada; compra devolvida sai como saída.
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const wItem = await buildWhere({ ...filters, especies: [] }, { alias: "f", incluirCanceladas: true });
  const wHead = await buildWhere({ ...filters, especies: [] }, { alias: "f" });

  const dev = (lado: "ent" | "sai") =>
    query<LadoQtdValor>(
      `select coalesce(sum(f.valortotal), 0)::float as valor,
              count(distinct f.chavelctofis${lado})::int as qtd
         from lctofis${lado}produto f
         join cfop cf on cf.codigoempresa = f.codigoempresa
                     and cf.codigoestab = f.codigoestab
                     and cf.codigocfop = f.codigocfop
        where ${wItem.sql} and cf.descrcfop ilike '%devolu%'`,
      wItem.params
    );
  const fat = (lado: "ent" | "sai") =>
    query<{ total: number }>(
      `select coalesce(sum(f.valorcontabil), 0)::float as total from lctofis${lado} f where ${wHead.sql}`,
      wHead.params
    );

  const [ent, sai, fatEnt, fatSai] = await Promise.all([
    dev("ent"),
    dev("sai"),
    fat("ent"),
    fat("sai"),
  ]);

  return {
    ent: ent[0],
    sai: sai[0],
    faturamentoEnt: fatEnt[0].total,
    faturamentoSai: fatSai[0].total,
  } satisfies DevolucoesResumo;
});
