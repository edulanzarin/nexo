import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { ConformidadeEmpresa } from "@/lib/types";

const NCM_INVALIDO =
  "(p.codigoncm is null or btrim(p.codigoncm) in ('', '99999999', '9999.99.99', '00000000', '0000.00.00'))";

interface NotasEmpRow {
  codigoempresa: number;
  canceladas: number;
  denegadas: number;
  sem_chave: number;
}
interface ItensEmpRow {
  codigoempresa: number;
  ncm_inv: number;
}

/** Ranking de empresas por pendências de conformidade (saídas). */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const wNotas = await buildWhere(filters, { alias: "f", incluirCanceladas: true });
  const wItens = await buildWhere({ ...filters, especies: [] }, { alias: "i", incluirCanceladas: true });

  const [notasEmp, itensEmp] = await Promise.all([
    query<NotasEmpRow>(
      `select f.codigoempresa,
              count(*) filter (where f.cancelada = '1')::int as canceladas,
              count(*) filter (where f.cdsituacao in (4, 5) and f.cancelada <> '1')::int as denegadas,
              count(*) filter (where f.cdmodelo in ('55','65','57')
                                 and f.cdsituacao <> 5
                                 and (f.chavenfesai is null or length(btrim(f.chavenfesai)) <> 44))::int as sem_chave
         from lctofissai f
        where ${wNotas.sql}
        group by 1`,
      wNotas.params
    ),
    query<ItensEmpRow>(
      `select i.codigoempresa, count(*)::int as ncm_inv
         from lctofissaiproduto i
         join produto p on p.codigoempresa = i.codigoempresa and p.codigoproduto = i.codigoproduto
        where ${wItens.sql} and ${NCM_INVALIDO}
        group by 1`,
      wItens.params
    ),
  ]);

  const mapa = new Map<number, ConformidadeEmpresa>();
  const pega = (codigo: number): ConformidadeEmpresa => {
    let e = mapa.get(codigo);
    if (!e) {
      e = { codigo, nome: null, ncmInvalido: 0, canceladas: 0, denegadas: 0, semChave: 0, pendencias: 0 };
      mapa.set(codigo, e);
    }
    return e;
  };
  for (const r of notasEmp) {
    const e = pega(r.codigoempresa);
    e.canceladas = r.canceladas;
    e.denegadas = r.denegadas;
    e.semChave = r.sem_chave;
  }
  for (const r of itensEmp) pega(r.codigoempresa).ncmInvalido = r.ncm_inv;

  const lista = [...mapa.values()]
    .map((e) => ({ ...e, pendencias: e.ncmInvalido + e.canceladas + e.denegadas + e.semChave }))
    .filter((e) => e.pendencias > 0)
    .sort((a, b) => b.pendencias - a.pendencias)
    .slice(0, 15);

  if (lista.length > 0) {
    const codigos = lista.map((e) => e.codigo);
    const nomes = await query<{ codigoempresa: number; nomeempresa: string }>(
      `select codigoempresa, nomeempresa from empresa where codigoempresa = any($1::int[])`,
      [codigos]
    );
    const nomeDe = new Map(nomes.map((n) => [n.codigoempresa, n.nomeempresa]));
    for (const e of lista) e.nome = nomeDe.get(e.codigo) ?? `Empresa ${e.codigo}`;
  }

  return lista;
});
