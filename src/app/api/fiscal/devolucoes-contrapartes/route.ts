import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { TopItem } from "@/lib/types";

/** Contrapartes (pessoa) que mais devolvem — item devolução → cabeçalho → pessoa. */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const tipo = req.nextUrl.searchParams.get("tipo") === "ent" ? "ent" : "sai";
  const metrica = req.nextUrl.searchParams.get("metrica") === "qtd" ? "qtd" : "valor";
  const cabecalho = tipo === "ent" ? "lctofisent" : "lctofissai";
  const chave = tipo === "ent" ? "chavelctofisent" : "chavelctofissai";
  const w = await buildWhere({ ...filters, especies: [] }, { alias: "f", incluirCanceladas: true });

  const rows = await query<TopItem>(
    `select p.codigopessoa as codigo,
            coalesce(p.nomepessoa, 'Pessoa ' || p.codigopessoa) as nome,
            max(p.siglaestado) as detalhe,
            coalesce(sum(f.valortotal), 0)::float as valor,
            count(distinct f.${chave})::int as qtd
       from lctofis${tipo}produto f
       join cfop cf on cf.codigoempresa = f.codigoempresa
                   and cf.codigoestab = f.codigoestab
                   and cf.codigocfop = f.codigocfop
       join ${cabecalho} h on h.codigoempresa = f.codigoempresa and h.${chave} = f.${chave}
       join pessoa p on p.codigopessoa = h.codigopessoa
      where ${w.sql} and cf.descrcfop ilike '%devolu%'
      group by p.codigopessoa, p.nomepessoa
      order by ${metrica} desc
      limit 10`,
    w.params
  );

  return rows.map((r) => ({
    codigo: r.codigo,
    nome: r.nome,
    valor: r.valor,
    qtd: r.qtd,
    detalhe: r.detalhe ?? null,
  }));
});
