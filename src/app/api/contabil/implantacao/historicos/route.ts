import { pool } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";

const LIMITE = 200;

/**
 * Históricos padrão do Questor (`historicoctb`) — GLOBAIS, não por empresa. São
 * ~10 mil, então a busca é server-side (por código ou descrição) com limite.
 *
 * `pedeComplemento`: a descrição do histórico traz marcadores `[DIC...]` (ex.:
 * "[DICTEXTOCONTACRED]") onde o texto livre entra. Só ~130 têm; os demais são
 * fechados e não pedem complemento — a tela usa isso para mostrar o campo só
 * quando faz sentido. A descrição exibida vem sem os marcadores.
 */
export const GET = apiRoute(async (req) => {
  const busca = (req.nextUrl.searchParams.get("busca") ?? "").trim();
  const params: unknown[] = [];
  let filtro = "codigohistctb > 0";
  if (busca) {
    params.push(`%${busca.toLowerCase()}%`);
    params.push(busca.replace(/\D/g, "") || "-1");
    filtro += ` and (lower(descrhistctb) like $1 or codigohistctb::text = $2)`;
  }

  const { rows } = await pool.query<{ codigo: number; descricao: string }>(
    `select codigohistctb codigo, btrim(descrhistctb) descricao
       from historicoctb
      where ${filtro}
      order by codigohistctb
      limit ${LIMITE}`,
    params
  );

  return rows.map((r) => ({
    codigo: r.codigo,
    descricao: r.descricao.replace(/\[DIC[^\]]*\]/g, "").replace(/\s+/g, " ").trim(),
    pedeComplemento: /\[DIC/.test(r.descricao),
  }));
});
