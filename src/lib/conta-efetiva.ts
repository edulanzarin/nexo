import { PoolClient } from "pg";
import { appPool, appQuery, erroAppDb } from "./app-db";
import type { PlanoCfop } from "./types";
import { contaDoPlano, type ContaEfetiva } from "./conta-efetiva-calculo";

/**
 * "Que conta esta natureza de SERVIÇO de fato recebe?" — aprendido do histórico,
 * porque para serviço a tabela de contabilização do Questor envelhece.
 *
 * Na mercadoria o CFOP determina a conta e a regra é viva. Na natureza de
 * serviço (código 8xxxxxx) não, por dois caminhos: a natureza específica aponta
 * pra conta aposentada (a empresa criou outra, às vezes com o mesmo nome e o
 * mesmo apelido, e só o contábil mudou); ou a nota entra pelo e-Doc com a
 * natureza GENÉRICA ("Serviço Tomados Geral") e é contabilizada pela específica
 * do catálogo da empresa — escolha que não fica gravada em lugar nenhum da nota.
 * O motor então cobrava a conta do papel e marcava TODA nota daquela natureza
 * como "conta errada", todo mês. Medido em mai–jul/2026: a conta do plano acerta
 * 62% das NFSE; a conta habitual da natureza acerta 86%.
 *
 * Aqui o aprendizado é só a CONTA (o "este CFOP contabiliza?" mora em
 * aprender-contabilizacao). Precedência: override manual > conta efetiva >
 * Questor. O que foge da conta habitual continua virando divergência — é o
 * achado que interessa.
 */

/** Notas mínimas para o histórico dizer algo, e dominância para virar regra. */
const MIN_NOTAS = 3;
const MIN_DOMINANCIA = 0.8;

interface ContagemRow {
  estab: number;
  cfop: number;
  conta: number;
  n: number;
}

/**
 * Por (estab, natureza de serviço) nos últimos 12 meses: em que conta caiu o
 * lançamento PRINCIPAL de cada nota, e quantas vezes. Só nota de UMA natureza —
 * em nota multi-natureza não dá para atribuir a conta a uma delas.
 *
 * "Perna principal" é a de valor igual ao valor contábil da nota, e NÃO a de
 * maior valor. Aprender pela maior funciona em serviço (uma perna fixa só) e
 * erra feio em mercadoria, onde a nota tem estoque, tributo a recuperar e às
 * vezes compensação — chegou a trocar despesa (4537) por conta de compensação
 * (5068), inflando o balancete em milhões. Nota cuja perna principal não se
 * identifica por valor fica de fora: melhor não aprender do que aprender errado.
 */
async function contarContas(
  client: PoolClient,
  empresa: number,
  tipo: "ent" | "sai"
): Promise<ContagemRow[]> {
  const prod = tipo === "ent" ? "lctofisentproduto" : "lctofissaiproduto";
  const nota = tipo === "ent" ? "lctofisent" : "lctofissai";
  const chaveCol = tipo === "ent" ? "chavelctofisent" : "chavelctofissai";
  const prefixo = tipo === "ent" ? "ME" : "MS";
  // Entrada debita a despesa/estoque; saída credita a receita.
  const contaCol = tipo === "ent" ? "contactbdeb" : "contactbcred";
  const { rows } = await client.query<ContagemRow>(
    `with prod as (
       select distinct codigoestab estab, codigocfop cfop, ${chaveCol} chave
         from ${prod}
        where codigoempresa = $1 and datalctofis >= current_date - interval '365 days'
     ),
     uma as (
       select chave, min(estab) estab, min(cfop) cfop
         from prod group by chave having count(*) = 1
     ),
     valor as (
       select ${chaveCol} chave, valorcontabil vlr
         from ${nota}
        where codigoempresa = $1 and datalctofis >= current_date - interval '365 days'
          and cancelada <> '1'
     ),
     real as (
       select substring(chaveorigem from 3)::bigint chave, ${contaCol} conta,
              sum(valorlctoctb) v
         from lctoctb
        where codigoempresa = $1 and codigooriglctoctb = 'FI'
          and chaveorigem ~ '^${prefixo}[0-9]+$'
          and datalctoctb >= current_date - interval '365 days'
          and ${contaCol} is not null
        group by 1, 2
     ),
     principal as (
       select distinct on (r.chave) r.chave, r.conta
         from real r join valor n on n.chave = r.chave
        where abs(r.v - n.vlr) < 0.02
        order by r.chave, abs(r.v - n.vlr)
     )
     select u.estab, u.cfop, p.conta, count(*)::int n
       from uma u join principal p on p.chave = u.chave
      group by u.estab, u.cfop, p.conta`,
    [empresa]
  );
  return rows;
}

/**
 * Reaprende a conta efetiva das naturezas de serviço da empresa (12 meses) e
 * regrava o cadastro. Lê o Questor pelo `client` (read-only), grava no app.
 * Devolve quantas naturezas ficaram cadastradas.
 */
export async function aprenderContaEfetiva(
  client: PoolClient,
  empresa: number,
  planoPorChave?: Map<string, PlanoCfop>
): Promise<number> {
  const [ent, sai] = await Promise.all([
    contarContas(client, empresa, "ent"),
    contarContas(client, empresa, "sai"),
  ]);

  // Moda por natureza: a conta mais frequente, e o quanto ela domina.
  const agrupado = new Map<string, { estab: number; cfop: number; total: number; melhor: ContagemRow }>();
  for (const r of [...ent, ...sai]) {
    const k = `${r.estab}:${r.cfop}`;
    const a = agrupado.get(k);
    if (!a) agrupado.set(k, { estab: r.estab, cfop: r.cfop, total: r.n, melhor: r });
    else {
      a.total += r.n;
      if (r.n > a.melhor.n) a.melhor = r;
    }
  }

  // Abaixo de MIN_NOTAS o histórico não diz nada: fica de fora e vale o Questor.
  const aceitas = [...agrupado.values()].filter((a) => a.total >= MIN_NOTAS);
  const habituais = new Map(
    aceitas.map((a) => [a, a.melhor.n >= a.total * MIN_DOMINANCIA] as const)
  );
  const nomes = await nomesDeConta(
    client,
    empresa,
    aceitas.filter((a) => habituais.get(a)).map((a) => a.melhor.conta)
  );

  let app;
  try {
    app = await appPool.connect();
  } catch (err) {
    throw erroAppDb(err);
  }
  try {
    await app.query("begin");
    // Substitui o cadastro inteiro: natureza que sumiu do histórico sai junto.
    await app.query("delete from conf_natureza_conta_efetiva where codigo_empresa = $1", [empresa]);
    for (const a of aceitas) {
      const plano = planoPorChave?.get(`${a.estab}:${a.cfop}`);
      const habitual = habituais.get(a) ?? false;
      await app.query(
        `insert into conf_natureza_conta_efetiva
           (codigo_empresa, codigo_estab, codigo_cfop, conta_plano, conta_efetiva,
            descr_efetiva, habitual, notas, acertos)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          empresa,
          a.estab,
          a.cfop,
          plano ? contaDoPlano(plano) : null,
          habitual ? a.melhor.conta : null,
          habitual ? (nomes.get(a.melhor.conta) ?? null) : null,
          habitual,
          a.total,
          a.melhor.n,
        ]
      );
    }
    await app.query(
      `insert into conf_natureza_conta_efetiva_run (codigo_empresa, naturezas)
       values ($1, $2)
       on conflict (codigo_empresa)
         do update set naturezas = excluded.naturezas, atualizado_em = now()`,
      [empresa, aceitas.length]
    );
    await app.query("commit");
  } catch (err) {
    await app.query("rollback").catch(() => {});
    throw erroAppDb(err);
  } finally {
    app.release();
  }
  return aceitas.length;
}

async function nomesDeConta(
  client: PoolClient,
  empresa: number,
  contas: number[]
): Promise<Map<number, string>> {
  if (!contas.length) return new Map();
  const { rows } = await client.query<{ contactb: number; descrconta: string }>(
    `select contactb, descrconta from planoespec
      where codigoempresa = $1 and contactb = any($2::bigint[])`,
    [empresa, [...new Set(contas)]]
  );
  return new Map(rows.map((r) => [r.contactb, r.descrconta]));
}

/**
 * A empresa ainda não foi semeada? Cadastro vazio é resultado legítimo (empresa
 * sem natureza de serviço), então quem responde isso é a marca de execução, não
 * o tamanho do cadastro — senão a varredura de 12 meses roda a cada request.
 */
export async function precisaAprenderContaEfetiva(empresa: number): Promise<boolean> {
  const rows = await appQuery<{ um: number }>(
    "select 1 um from conf_natureza_conta_efetiva_run where codigo_empresa = $1",
    [empresa]
  );
  return rows.length === 0;
}

/** Lê o cadastro aprendido da empresa, indexado por "estab:cfop". */
export async function buscarContaEfetiva(empresa: number): Promise<Map<string, ContaEfetiva>> {
  const rows = await appQuery<{
    codigo_estab: number;
    codigo_cfop: number;
    conta_plano: number | null;
    conta_efetiva: number | null;
    descr_efetiva: string | null;
    habitual: boolean;
    notas: number;
    acertos: number;
  }>(
    `select codigo_estab, codigo_cfop, conta_plano, conta_efetiva, descr_efetiva,
            habitual, notas, acertos
       from conf_natureza_conta_efetiva where codigo_empresa = $1`,
    [empresa]
  );
  const mapa = new Map<string, ContaEfetiva>();
  for (const r of rows) {
    mapa.set(`${r.codigo_estab}:${r.codigo_cfop}`, {
      contaPlano: r.conta_plano,
      contaEfetiva: r.conta_efetiva,
      descrEfetiva: r.descr_efetiva,
      habitual: r.habitual,
      notas: r.notas,
      acertos: r.acertos,
    });
  }
  return mapa;
}
