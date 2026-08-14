import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { conferir, type Opcoes, type Ordem } from "@/lib/conferencia-servico";

/**
 * Conferência Fiscal: cruza as notas do período com os lançamentos contábeis
 * (origem FI) e com o plano de contabilização do CFOP. Devolve TODAS as notas
 * com a sua situação — não só as problemáticas —, para dar de filtrar por
 * corretas, pendentes, divergentes etc. O núcleo `conferir` mora em
 * `@/lib/conferencia-servico`, compartilhado com a Central de Pendências.
 */
export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  if (filters.empresas.length !== 1) {
    throw new FilterError("Selecione uma empresa para a conferência");
  }
  await assertEmpresaVisivel(filters.empresas[0]);
  const p = req.nextUrl.searchParams;
  const cfops = (p.get("cfops") ?? "")
    .split(",")
    .filter(Boolean)
    .map((v) => {
      const n = Number(v);
      if (!Number.isInteger(n)) throw new FilterError(`CFOP inválido: ${v}`);
      return n;
    });

  const opcoes: Opcoes = {
    tipo: p.get("tipo") === "sai" ? "sai" : "ent",
    situacao: p.get("situacao") ?? "problema",
    busca: p.get("busca") ?? "",
    especies: (p.get("especies") ?? "").split(",").filter(Boolean).map((e) => e.toUpperCase()),
    cfops,
    ordem: (p.get("ordem") ?? "valor_desc") as Ordem,
    pagina: Number(p.get("pagina") ?? 1) || 1,
  };

  const client = await pool.connect();
  try {
    return await conferir(client, filters.empresas[0], filters.inicio, filters.fim, filters.estabs, opcoes);
  } finally {
    client.release();
  }
});
