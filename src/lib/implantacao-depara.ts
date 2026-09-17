import { PoolClient } from "pg";
import { appQuery } from "./app-db";
import type { ContaAlvo } from "./implantacao-tipos";

// A cascata do de-para mora em `implantacao-casamento.ts` (pura, testável);
// aqui ficam só os carregadores que a alimentam.
export { casarBalancete } from "./implantacao-casamento";

// ── Carregadores (DB) ───────────────────────────────────────────────────────

/** Plano de contas da empresa no Questor (read-only) como alvos do de-para. */
export async function carregarAlvos(
  client: PoolClient,
  empresa: number
): Promise<ContaAlvo[]> {
  const { rows } = await client.query<{
    conta: number;
    classif: string;
    descr: string;
    tipoconta: number;
    natursaldo: number | null;
  }>(
    `select contactb conta, classifconta classif, descrconta descr,
            tipoconta, natursaldo
       from planoespec where codigoempresa = $1`,
    [empresa]
  );
  return rows.map((r) => ({
    conta: r.conta,
    classif: r.classif,
    descricao: r.descr,
    sintetica: r.tipoconta === 1,
    natureza: r.natursaldo === -1 ? "C" : "D",
  }));
}

/** Overrides salvos (banco do app): chave de origem → conta do Questor. */
export async function carregarOverrides(empresa: number): Promise<Map<string, number>> {
  const rows = await appQuery<{ origem_chave: string; conta_questor: number | null }>(
    `select origem_chave, conta_questor from implantacao_depara
      where codigo_empresa = $1 and conta_questor is not null`,
    [empresa]
  );
  return new Map(rows.map((r) => [r.origem_chave, r.conta_questor as number]));
}
