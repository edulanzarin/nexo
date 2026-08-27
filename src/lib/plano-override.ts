import { appPool, appQuery, erroAppDb } from "./app-db";
import type { LinhaPlano, PlanoCfop } from "./types";

/**
 * Override do plano de contabilização. Quando existe um override para o CFOP,
 * ele SUBSTITUI o que o Questor configura — a conferência passa a cobrar as
 * contas daqui. Sem override, vale o plano do Questor.
 *
 * Um override com codigo_estab = 0 vale para todos os estabelecimentos; um
 * override específico do estabelecimento tem precedência sobre ele.
 */
export interface Override {
  id: number;
  empresa: number;
  estab: number;
  cfop: number;
  contabiliza: boolean;
  observacao: string | null;
  linhas: LinhaPlano[];
}

interface RegraRow {
  id: number;
  codigo_empresa: number;
  codigo_estab: number;
  codigo_cfop: number;
  contabiliza: boolean;
  observacao: string | null;
}

interface LinhaRow {
  regra_id: number;
  seq: number;
  natureza: number;
  conta: number | null;
  origem_conta: number;
  regra_valor: string | null;
  rotulo: string | null;
}

export async function listarOverrides(empresa: number): Promise<Override[]> {
  const regras = await appQuery<RegraRow>(
    `select id, codigo_empresa, codigo_estab, codigo_cfop, contabiliza, observacao
       from conf_regra where codigo_empresa = $1`,
    [empresa]
  );
  if (!regras.length) return [];

  const linhas = await appQuery<LinhaRow>(
    `select regra_id, seq, natureza, conta, origem_conta, regra_valor, rotulo
       from conf_regra_linha where regra_id = any($1::int[]) order by regra_id, seq`,
    [regras.map((r) => r.id)]
  );

  const porRegra = new Map<number, LinhaPlano[]>();
  for (const l of linhas) {
    const linha: LinhaPlano = {
      seq: l.seq,
      natureza: l.natureza >= 0 ? 1 : -1,
      conta: l.conta,
      contaVariavel: l.origem_conta !== 0,
      origemConta: l.origem_conta,
      descrConta: l.rotulo,
      regraValor: l.regra_valor,
      // Override é regra de quem confere, não do ERP: não carimba histórico, e
      // por isso não se casa com lançamento de apuração.
      historico: null,
    };
    const lista = porRegra.get(l.regra_id);
    if (lista) lista.push(linha);
    else porRegra.set(l.regra_id, [linha]);
  }

  return regras.map((r) => ({
    id: r.id,
    empresa: r.codigo_empresa,
    estab: r.codigo_estab,
    cfop: r.codigo_cfop,
    contabiliza: r.contabiliza,
    observacao: r.observacao,
    linhas: porRegra.get(r.id) ?? [],
  }));
}

/** Índice de busca com fallback: estabelecimento específico → regra geral (estab 0). */
export function indexar(overrides: Override[]): Map<string, Override> {
  const mapa = new Map<string, Override>();
  for (const o of overrides) mapa.set(`${o.estab}:${o.cfop}`, o);
  return mapa;
}

export function acharOverride(
  mapa: Map<string, Override>,
  estab: number,
  cfop: number
): Override | undefined {
  return mapa.get(`${estab}:${cfop}`) ?? mapa.get(`0:${cfop}`);
}

/** Aplica os overrides sobre o plano lido do Questor. */
export function aplicarOverrides(plano: PlanoCfop[], overrides: Override[]): PlanoCfop[] {
  if (!overrides.length) return plano;
  const mapa = indexar(overrides);

  return plano.map((p) => {
    const o = acharOverride(mapa, p.estab, p.cfop);
    if (!o) return p;
    return {
      ...p,
      origem: "override" as const,
      contabiliza: o.contabiliza,
      observacao: o.observacao,
      // O override é um plano fechado: uma lista única de lançamentos esperados,
      // sem a divisão por tributo que o Questor faz via tabelas.
      componentes: o.contabiliza
        ? [
            {
              id: "override",
              rotulo: "Lançamentos definidos",
              retido: false,
              tabela: null,
              descrTabela: null,
              linhas: o.linhas,
            },
          ]
        : [],
    };
  });
}

export interface SalvarOverride {
  empresa: number;
  estab: number;
  cfop: number;
  contabiliza: boolean;
  observacao?: string | null;
  linhas: Array<{
    natureza: 1 | -1;
    conta: number | null;
    origemConta: number;
    regraValor?: string | null;
    rotulo?: string | null;
  }>;
}

export async function salvarOverride(entrada: SalvarOverride): Promise<number> {
  let client;
  try {
    client = await appPool.connect();
  } catch (err) {
    throw erroAppDb(err);
  }
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: number }>(
      `insert into conf_regra (codigo_empresa, codigo_estab, codigo_cfop, contabiliza, observacao)
            values ($1, $2, $3, $4, $5)
       on conflict (codigo_empresa, codigo_estab, codigo_cfop)
         do update set contabiliza = excluded.contabiliza, observacao = excluded.observacao
         returning id`,
      [entrada.empresa, entrada.estab, entrada.cfop, entrada.contabiliza, entrada.observacao ?? null]
    );
    const id = rows[0].id;

    // Regravar as linhas inteiras é mais simples e seguro que casar seq a seq.
    await client.query("delete from conf_regra_linha where regra_id = $1", [id]);
    let seq = 0;
    for (const l of entrada.linhas) {
      seq += 1;
      await client.query(
        `insert into conf_regra_linha (regra_id, seq, natureza, conta, origem_conta, regra_valor, rotulo)
              values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, seq, l.natureza, l.conta, l.origemConta, l.regraValor ?? null, l.rotulo ?? null]
      );
    }
    await client.query("commit");
    return id;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw erroAppDb(err);
  } finally {
    client.release();
  }
}

/** Remove o override e faz o CFOP voltar a seguir o plano do Questor. */
export async function removerOverride(
  empresa: number,
  estab: number,
  cfop: number
): Promise<boolean> {
  const rows = await appQuery<{ id: number }>(
    `delete from conf_regra
      where codigo_empresa = $1 and codigo_estab = $2 and codigo_cfop = $3 returning id`,
    [empresa, estab, cfop]
  );
  return rows.length > 0;
}
