import { query } from "./db";
import { parseFilters, buildWhere } from "./fiscal-filters";
import type { NotaLista, NotasListaResp } from "./types";

const PAGE_SIZE = 50;
/** Teto de linhas na exportação: protege a memória/o tempo sem paginar o CSV. */
const EXPORT_MAX = 10_000;

/**
 * Listagem bruta de notas fiscais (explorador de dados). Paginada e com busca
 * por número da nota (se for só dígitos) ou nome da contraparte. Inclui
 * canceladas (marcadas). Escopo vem dos filtros compartilhados.
 *
 * A mesma consulta serve o Fiscal (seção Dados) e o Contábil (seção Notas) —
 * cada módulo pela sua própria rota, gateada pelo módulo; a query é uma só.
 */
export async function buscarNotasLista(sp: URLSearchParams): Promise<NotasListaResp> {
  const filters = parseFilters(sp);
  const tipo = sp.get("tipo") === "ent" ? "ent" : "sai";
  const tabela = `lctofis${tipo}`;
  const chaveCol = tipo === "ent" ? "chavelctofisent" : "chavelctofissai";
  const chaveNfeCol = tipo === "ent" ? "chavenfeent" : "chavenfesai";
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  // Modo exportação: devolve o conjunto filtrado inteiro (até o teto), sem paginar.
  const exportar = sp.get("export") === "1";
  const busca = (sp.get("busca") ?? "").trim();
  const buscaNumero = /^\d+$/.test(busca);
  const situacao = sp.get("situacao"); // "canceladas" | "normais" | null (todas)
  const pessoa = Number.parseInt(sp.get("pessoa") ?? "", 10);

  const w = await buildWhere(filters, { incluirCanceladas: true, alias: "f" });
  const conds = [w.sql];
  const params = [...w.params];

  if (situacao === "canceladas") conds.push(`f.cancelada = '1'`);
  else if (situacao === "normais") conds.push(`f.cancelada <> '1'`);

  if (Number.isInteger(pessoa)) {
    params.push(pessoa);
    conds.push(`f.codigopessoa = $${params.length}`);
  }

  if (busca) {
    if (buscaNumero) {
      params.push(Number(busca));
      conds.push(`f.numeronf = $${params.length}`);
    } else {
      params.push(`%${busca}%`);
      conds.push(`p.nomepessoa ilike $${params.length}`);
    }
  }
  const where = conds.join(" and ");
  // só precisa juntar pessoa no count quando a busca é por nome
  const joinPessoaCount = busca && !buscaNumero
    ? "left join pessoa p on p.codigopessoa = f.codigopessoa"
    : "";

  const limite = exportar ? EXPORT_MAX : PAGE_SIZE;
  const offset = exportar ? 0 : (page - 1) * PAGE_SIZE;

  const [totalRes, rows] = await Promise.all([
    query<{ total: number }>(
      `select count(*)::int as total from ${tabela} f ${joinPessoaCount} where ${where}`,
      params
    ),
    query<NotaLista>(
      `select f.codigoempresa as empresa,
              e.nomeempresa as "empresaNome",
              f.${chaveCol}::text as chave,
              f.numeronf as numero,
              nullif(btrim(f.serienf), '') as serie,
              upper(btrim(f.especienf)) as especie,
              nullif(btrim(f.cdmodelo), '') as modelo,
              to_char(f.datalctofis, 'YYYY-MM-DD') as data,
              p.nomepessoa as contraparte,
              p.inscrfederal as "contraparteDoc",
              p.siglaestado as uf,
              f.valorcontabil::float as valor,
              (f.cancelada = '1') as cancelada,
              nullif(btrim(f.${chaveNfeCol}), '') as "chaveNfe"
         from ${tabela} f
         left join pessoa p on p.codigopessoa = f.codigopessoa
         left join empresa e on e.codigoempresa = f.codigoempresa
        where ${where}
        order by f.datalctofis desc, f.numeronf desc
        limit ${limite} offset ${offset}`,
      params
    ),
  ]);

  return {
    rows,
    total: totalRes[0].total,
    page: exportar ? 1 : page,
    pageSize: exportar ? EXPORT_MAX : PAGE_SIZE,
  } satisfies NotasListaResp;
}
