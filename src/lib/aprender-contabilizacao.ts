import { PoolClient } from "pg";
import { appPool, appQuery, erroAppDb } from "./app-db";

/**
 * "Este CFOP gera lançamento?" — aprendido do histórico, não da config do
 * Questor (que erra dos dois lados) nem do mês da tela (que quebra em mês ainda
 * não fechado). O sinal: nos últimos 12 meses, alguma nota do CFOP foi de fato
 * contabilizada? Se sim, o CFOP contabiliza. É semeado do Questor (read-only) e
 * guardado no banco do app; o override manual (conf_regra) tem precedência.
 */

export interface AutoContab {
  contabiliza: boolean;
  notas: number;
  contabilizadas: number;
  atualizadoEm: string;
}

interface ContagemRow {
  estab: number;
  cfop: number;
  notas: number;
  contabilizadas: number;
}

/** Por (estab, cfop) num lado: quantas notas dos últimos 12m e quantas foram
 *  contabilizadas (têm lançamento FI). Canceladas não importam: o critério é
 *  "houve ≥1 contabilização", e cancelada não gera lançamento. */
async function contarPorCfop(
  client: PoolClient,
  empresa: number,
  tipo: "ent" | "sai"
): Promise<ContagemRow[]> {
  const prod = tipo === "ent" ? "lctofisentproduto" : "lctofissaiproduto";
  const chaveCol = tipo === "ent" ? "chavelctofisent" : "chavelctofissai";
  const prefix = tipo === "ent" ? "ME" : "MS";
  const { rows } = await client.query<ContagemRow>(
    `with prod as (
       select distinct codigoestab estab, codigocfop cfop, ${chaveCol} chave
         from ${prod}
        where codigoempresa = $1 and datalctofis >= current_date - interval '365 days'
     ),
     booked as (
       select distinct substring(chaveorigem from 3)::bigint chave
         from lctoctb
        where codigoempresa = $1 and codigooriglctoctb = 'FI' and chaveorigem like '${prefix}%'
          and datalctoctb >= current_date - interval '365 days'
     )
     select prod.estab, prod.cfop,
            count(*)::int notas, count(booked.chave)::int contabilizadas
       from prod left join booked on booked.chave = prod.chave
      group by prod.estab, prod.cfop`,
    [empresa]
  );
  return rows;
}

/**
 * Reaprende a contabilização de TODOS os CFOPs da empresa a partir dos últimos
 * 12 meses e regrava o cadastro (substitui o anterior). Lê o Questor pelo
 * `client` (read-only) e grava no banco do app. Devolve quantos CFOPs cadastrou.
 */
/** Chave da trava de transação (pg_advisory_xact_lock) do aprendizado em conf_cfop_contabiliza. */
const TRAVA_CONTABILIZA = 71_001;

export async function aprenderContabilizacao(
  client: PoolClient,
  empresa: number
): Promise<number> {
  const [ent, sai] = await Promise.all([
    contarPorCfop(client, empresa, "ent"),
    contarPorCfop(client, empresa, "sai"),
  ]);
  const linhas = [...ent, ...sai];

  let app;
  try {
    app = await appPool.connect();
  } catch (err) {
    throw erroAppDb(err);
  }
  try {
    await app.query("begin");
    // Uma empresa aprende de cada vez. A Central de pendências roda a Conferência
    // de entradas e a de saídas em paralelo, e numa empresa ainda não semeada as
    // duas chegavam aqui juntas: apagavam o nada, inseriam as mesmas chaves, e a
    // segunda morria em "duplicate key". Com a trava, a segunda espera a primeira.
    await app.query("select pg_advisory_xact_lock($1, $2)", [TRAVA_CONTABILIZA, empresa]);
    // Substitui o cadastro inteiro da empresa: some CFOP que sumiu do histórico.
    await app.query("delete from conf_cfop_contabiliza where codigo_empresa = $1", [empresa]);
    for (const l of linhas) {
      // Contabiliza se foi lançado na MAIORIA das notas (≥50%). "≥1" pegaria
      // exceção/erro (ex.: CFOP com 2 lançados em 29 notas) e viraria pendência
      // falsa; CFOP que de fato contabiliza fica em ~85–97%, bem acima do corte.
      const contabiliza = l.notas > 0 && l.contabilizadas * 2 >= l.notas;
      await app.query(
        `insert into conf_cfop_contabiliza
           (codigo_empresa, codigo_estab, codigo_cfop, contabiliza, notas, contabilizadas)
         values ($1, $2, $3, $4, $5, $6)`,
        [empresa, l.estab, l.cfop, contabiliza, l.notas, l.contabilizadas]
      );
    }
    await app.query("commit");
  } catch (err) {
    await app.query("rollback").catch(() => {});
    throw erroAppDb(err);
  } finally {
    app.release();
  }
  return linhas.length;
}

/** Lê o cadastro aprendido da empresa, indexado por "estab:cfop". */
export async function buscarAutoContabiliza(empresa: number): Promise<Map<string, AutoContab>> {
  const rows = await appQuery<{
    codigo_estab: number;
    codigo_cfop: number;
    contabiliza: boolean;
    notas: number;
    contabilizadas: number;
    atualizado_em: string;
  }>(
    `select codigo_estab, codigo_cfop, contabiliza, notas, contabilizadas, atualizado_em
       from conf_cfop_contabiliza where codigo_empresa = $1`,
    [empresa]
  );
  const mapa = new Map<string, AutoContab>();
  for (const r of rows) {
    mapa.set(`${r.codigo_estab}:${r.codigo_cfop}`, {
      contabiliza: r.contabiliza,
      notas: r.notas,
      contabilizadas: r.contabilizadas,
      atualizadoEm: r.atualizado_em,
    });
  }
  return mapa;
}
