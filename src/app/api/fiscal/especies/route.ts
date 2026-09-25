import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { parseFilters, buildWhere } from "@/lib/fiscal-filters";
import type { EspecieResumo } from "@/lib/types";

interface EspecieRow {
  especie: string;
  valor: number;
  qtd: number;
}

const MAX_FATIAS = 5;

export const GET = apiRoute(async (req) => {
  const filters = parseFilters(req.nextUrl.searchParams);
  const { sql, params } = await buildWhere(filters);

  const porTabela = (tabela: string) =>
    query<EspecieRow>(
      `select upper(btrim(especienf)) as especie,
              coalesce(sum(valorcontabil), 0)::float as valor,
              count(*)::int as qtd
         from ${tabela}
        where ${sql}
        group by 1`,
      params
    );

  const [ent, sai] = await Promise.all([
    porTabela("lctofisent"),
    porTabela("lctofissai"),
  ]);

  const mapa = new Map<string, EspecieResumo>();
  const item = (especie: string): EspecieResumo => {
    let e = mapa.get(especie);
    if (!e) {
      e = { especie, entradas: 0, saidas: 0, qtd: 0 };
      mapa.set(especie, e);
    }
    return e;
  };
  for (const r of ent) {
    const e = item(r.especie);
    e.entradas += r.valor;
    e.qtd += r.qtd;
  }
  for (const r of sai) {
    const e = item(r.especie);
    e.saidas += r.valor;
    e.qtd += r.qtd;
  }

  const ordenadas = [...mapa.values()].sort(
    (a, b) => b.entradas + b.saidas - (a.entradas + a.saidas)
  );
  const principais = ordenadas.slice(0, MAX_FATIAS);
  const resto = ordenadas.slice(MAX_FATIAS);
  if (resto.length > 0) {
    principais.push(
      resto.reduce(
        (acc, e) => ({
          especie: "Outras",
          entradas: acc.entradas + e.entradas,
          saidas: acc.saidas + e.saidas,
          qtd: acc.qtd + e.qtd,
        }),
        { especie: "Outras", entradas: 0, saidas: 0, qtd: 0 }
      )
    );
  }
  return principais;
});
