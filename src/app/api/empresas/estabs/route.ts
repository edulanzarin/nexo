import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessao, podeVerEmpresa } from "@/lib/sessao";
import type { Filial } from "@/lib/types";

/**
 * Filiais (estabelecimentos) de uma empresa — alimenta o seletor de filial das
 * barras de filtro. Respeita o escopo: empresa fora do alcance devolve vazio
 * (não vaza a estrutura de filiais de quem o usuário não pode ver).
 */
export const GET = apiRoute(async (req) => {
  const empresa = Number(req.nextUrl.searchParams.get("empresa"));
  if (!Number.isInteger(empresa)) throw new FilterError("Informe a empresa");
  if (!podeVerEmpresa(await getSessao(), empresa)) return [] satisfies Filial[];

  const rows = await query<Filial>(
    `select codigoestab,
            coalesce(nullif(btrim(apelidoestab), ''), nullif(btrim(nomeestab), ''),
                     'Filial ' || codigoestab) as nome
       from estab
      where codigoempresa = $1
      order by codigoestab`,
    [empresa]
  );
  return rows satisfies Filial[];
});
