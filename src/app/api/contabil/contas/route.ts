import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import type { ContaPlano } from "@/lib/types";

const LIMITE = 200;
/** Disponibilidades: 1.1.01.001 = caixa, 1.1.01.002 = bancos. */
const PREFIXO_DISPONIVEL = "1.1.01.";

/**
 * Contas do plano da empresa, para escolher a conta do banco e as
 * contrapartidas. Só analíticas (`tipoconta = 2`) — sintética é agrupadora e
 * não recebe lançamento.
 */
export const GET = apiRoute(async (req) => {
  const p = req.nextUrl.searchParams;
  const empresa = Number(p.get("empresa"));
  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);

  const busca = (p.get("busca") ?? "").trim();
  const soBanco = p.get("banco") === "1";

  const params: unknown[] = [empresa];
  let filtro = "";
  if (soBanco) {
    params.push(`${PREFIXO_DISPONIVEL}%`);
    filtro += ` and classifconta like $${params.length}`;
  }
  if (busca) {
    // Busca por número da conta ou por parte da descrição.
    params.push(`%${busca.toLowerCase()}%`);
    const i = params.length;
    params.push(busca.replace(/\D/g, "") || "-1");
    filtro += ` and (lower(descrconta) like $${i} or contactb::text = $${params.length}
                     or classifconta like $${i})`;
  }

  const { rows } = await pool.query<ContaPlano & { natursaldo: number | null }>(
    `select contactb conta, btrim(descrconta) descricao, classifconta classificacao, natursaldo
       from planoespec
      where codigoempresa = $1 and tipoconta = 2${filtro}
      order by classifconta, contactb
      limit ${LIMITE}`,
    params
  );
  return rows.map(({ natursaldo, ...r }) => ({
    ...r,
    natureza: natursaldo === -1 ? ("C" as const) : ("D" as const),
  }));
});
