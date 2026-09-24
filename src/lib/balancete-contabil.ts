import { PoolClient } from "pg";
import type { BalanceteContabilLinha, BalanceteContabilResp } from "./types";
import { validarBalancete } from "./validacao-balancete";

/**
 * Balancete CONTÁBIL de saldos (o de verdade, não o fiscal hipotético do
 * `balancete-fiscal.ts`). Monta, por conta do plano da empresa, o saldo inicial,
 * o movimento (débito/crédito) de cada mês do período e o saldo ao fim de cada
 * mês — a matéria-prima da Análise de Balancete por IA.
 *
 * ── De onde vêm os dados ────────────────────────────────────────────────────
 * Tudo sai de `lctoctb` (partida dobrada, colunas documentadas em
 * [[Módulo contábil do Questor]]). Preferimos `lctoctb` a `saldoctb` porque as
 * colunas de `lctoctb` estão validadas e já em uso na rota do balancete fiscal;
 * filtrando por UMA empresa a consulta é leve (índice codigoempresa+data).
 *
 * ── Duas premissas contábeis a validar contra um balancete conhecido ─────────
 *  1. `tipolancamento = 'LN'` (lançamento normal/societário). Empresas com dupla
 *     escrituração (LF/LS) precisariam escolher a escrituração; LN é o padrão.
 *  2. Saldo inicial = acumulado de TODOS os lançamentos anteriores a `inicio`.
 *     Para contas de resultado (receita/despesa), que zeram no fim do exercício,
 *     o saldo inicial dentro do mesmo exercício reflete o acumulado do ano — o
 *     que é o esperado num balancete mensal.
 */

const TIPO_LANCAMENTO = "LN";

export interface MesMov {
  /** "YYYY-MM". */
  mes: string;
  debito: number;
  credito: number;
  /** Saldo acumulado ao fim do mês (saldo inicial + Σ movimentos até aqui). */
  saldoFinal: number;
}

export interface ContaBalancete {
  conta: number;
  /** Classificação hierárquica: "1.1.01.0001". Ordena a árvore. */
  classif: string;
  /** Profundidade na árvore (nº de segmentos do classif). */
  nivel: number;
  descricao: string;
  /** true = conta sintética (agrupadora); false = analítica (recebe lançamento). */
  sintetica: boolean;
  /** Natureza do saldo: "D" devedora, "C" credora. */
  natureza: "D" | "C";
  /** Saldo antes do primeiro mês do período (sinal: devedor +, credor −). */
  saldoInicial: number;
  /** Movimento e saldo ao fim de cada mês do período, em ordem cronológica. */
  meses: MesMov[];
}

export interface BalanceteContabil {
  empresa: { codigo: number; nome: string; cnpj: string | null };
  /** Meses do período em ordem, "YYYY-MM". */
  mesesLabels: string[];
  contas: ContaBalancete[];
}

/** Lista de "YYYY-MM" do mês de `inicio` ao mês de `fim`, inclusive. */
export function mesesDoPeriodo(inicio: string, fim: string): string[] {
  const [ai, mi] = inicio.slice(0, 7).split("-").map(Number);
  const [af, mf] = fim.slice(0, 7).split("-").map(Number);
  const out: string[] = [];
  let ano = ai;
  let mes = mi;
  while (ano < af || (ano === af && mes <= mf)) {
    out.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return out;
}

export async function coletarBalanceteContabil(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  estabs: number[] = []
): Promise<BalanceteContabil> {
  const meses = mesesDoPeriodo(inicio, fim);
  // Primeiro dia do primeiro mês: o saldo inicial acumula tudo antes dele.
  const primeiroDia = `${meses[0]}-01`;

  const temEstab = estabs.length > 0;
  const estabDeb = temEstab ? " and codigoestab = any($4::int[])" : "";
  const estabParams = temEstab ? [estabs] : [];

  // ── Saldo inicial: acumulado (débito − crédito) de tudo antes do período ──
  const saldoIniRows = await client.query<{ conta: number; saldo: number }>(
    `select conta, sum(saldo)::float saldo from (
        select contactbdeb conta, sum(valorlctoctb) saldo
          from lctoctb
         where codigoempresa = $1 and tipolancamento = $2
           and datalctoctb < $3 and contactbdeb is not null${estabDeb}
         group by contactbdeb
        union all
        select contactbcred, -sum(valorlctoctb)
          from lctoctb
         where codigoempresa = $1 and tipolancamento = $2
           and datalctoctb < $3 and contactbcred is not null${estabDeb}
         group by contactbcred
     ) t group by conta`,
    [empresa, TIPO_LANCAMENTO, primeiroDia, ...estabParams]
  );
  const saldoInicial = new Map<number, number>();
  for (const r of saldoIniRows.rows) saldoInicial.set(r.conta, r.saldo);

  // ── Movimento por conta e por mês dentro do período ──
  // Limite superior EXCLUSIVO = 1º dia do mês seguinte ao último (evita datas
  // inválidas tipo "2026-06-31" e cobre o mês inteiro em qualquer mês).
  const [uy, um] = meses[meses.length - 1].split("-").map(Number);
  const fimExclusivo =
    um === 12 ? `${uy + 1}-01-01` : `${uy}-${String(um + 1).padStart(2, "0")}-01`;
  const estabMovDeb = temEstab ? " and codigoestab = any($5::int[])" : "";
  const movParams = temEstab ? [estabs] : [];
  const movRows = await client.query<{
    conta: number;
    mes: string;
    debito: number;
    credito: number;
  }>(
    `select conta, mes, sum(debito)::float debito, sum(credito)::float credito from (
        select contactbdeb conta, to_char(datalctoctb, 'YYYY-MM') mes,
               sum(valorlctoctb) debito, 0 credito
          from lctoctb
         where codigoempresa = $1 and tipolancamento = $2
           and datalctoctb >= $3 and datalctoctb < $4 and contactbdeb is not null${estabMovDeb}
         group by contactbdeb, to_char(datalctoctb, 'YYYY-MM')
        union all
        select contactbcred, to_char(datalctoctb, 'YYYY-MM'), 0, sum(valorlctoctb)
          from lctoctb
         where codigoempresa = $1 and tipolancamento = $2
           and datalctoctb >= $3 and datalctoctb < $4 and contactbcred is not null${estabMovDeb}
         group by contactbcred, to_char(datalctoctb, 'YYYY-MM')
     ) t group by conta, mes`,
    [empresa, TIPO_LANCAMENTO, primeiroDia, fimExclusivo, ...movParams]
  );
  // conta -> mes -> {deb, cred}
  const movPorConta = new Map<number, Map<string, { deb: number; cred: number }>>();
  for (const r of movRows.rows) {
    let m = movPorConta.get(r.conta);
    if (!m) movPorConta.set(r.conta, (m = new Map()));
    const cur = m.get(r.mes) ?? { deb: 0, cred: 0 };
    cur.deb += r.debito;
    cur.cred += r.credito;
    m.set(r.mes, cur);
  }

  // ── Plano de contas da empresa ──
  const plano = await client.query<{
    conta: number;
    classif: string;
    descr: string | null;
    tipoconta: number;
    natursaldo: number | null;
  }>(
    `select contactb conta, classifconta classif, descrconta descr,
            tipoconta, natursaldo
       from planoespec where codigoempresa = $1`,
    [empresa]
  );
  const info = new Map<
    number,
    { classif: string; descr: string | null; sintetica: boolean; natureza: "D" | "C" }
  >();
  const sinteticas = new Set<string>();
  for (const r of plano.rows) {
    const sintetica = r.tipoconta === 1;
    info.set(r.conta, {
      classif: r.classif,
      descr: r.descr,
      sintetica,
      // natursaldo é smallint no Questor: 1 = devedora, -1 = credora.
      natureza: r.natursaldo === -1 ? "C" : "D",
    });
    if (sintetica) sinteticas.add(r.classif);
  }

  // ── Empresa (nome e CNPJ para o cabeçalho do laudo) ──
  // `empresa` só tem nome; a identidade fiscal (CNPJ) mora em `estab` — o CNPJ
  // é o da matriz (codigoestab = 1). Ver [[Cadastros centrais do Questor]].
  const emp = await client.query<{ nome: string; cnpj: string | null }>(
    `select e.nomeempresa nome, es.inscrfederal cnpj
       from empresa e
       left join estab es on es.codigoempresa = e.codigoempresa and es.codigoestab = 1
      where e.codigoempresa = $1`,
    [empresa]
  );
  const empresaInfo = {
    codigo: empresa,
    nome: emp.rows[0]?.nome ?? String(empresa),
    cnpj: emp.rows[0]?.cnpj ?? null,
  };

  // ── Rollup das analíticas nas sintéticas ancestrais (por prefixo do classif) ──
  // Cada conta com movimento ou saldo soma nos seus ancestrais sintéticos.
  const contasEnvolvidas = new Set<number>([
    ...saldoInicial.keys(),
    ...movPorConta.keys(),
  ]);

  // Acumuladores por classif sintético: saldoInicial + movimento por mês.
  const acumSint = new Map<
    string,
    { saldoIni: number; meses: Map<string, { deb: number; cred: number }> }
  >();
  const bumpSint = (
    classif: string,
    saldoIni: number,
    movMeses: Map<string, { deb: number; cred: number }> | undefined
  ) => {
    let a = acumSint.get(classif);
    if (!a) acumSint.set(classif, (a = { saldoIni: 0, meses: new Map() }));
    a.saldoIni += saldoIni;
    if (movMeses) {
      for (const [mes, mv] of movMeses) {
        const cur = a.meses.get(mes) ?? { deb: 0, cred: 0 };
        cur.deb += mv.deb;
        cur.cred += mv.cred;
        a.meses.set(mes, cur);
      }
    }
  };

  for (const conta of contasEnvolvidas) {
    const inf = info.get(conta);
    if (!inf || inf.sintetica) continue; // só analítica gera movimento próprio
    const saldoIni = saldoInicial.get(conta) ?? 0;
    const mov = movPorConta.get(conta);
    const seg = inf.classif.split(".");
    for (let k = 1; k < seg.length; k++) {
      const prefixo = seg.slice(0, k).join(".");
      if (sinteticas.has(prefixo)) bumpSint(prefixo, saldoIni, mov);
    }
  }

  // ── Monta as linhas do balancete ──
  const montarMeses = (
    saldoIni: number,
    mov: Map<string, { deb: number; cred: number }> | undefined
  ): MesMov[] => {
    let saldo = saldoIni;
    return meses.map((mes) => {
      const mv = mov?.get(mes) ?? { deb: 0, cred: 0 };
      saldo += mv.deb - mv.cred; // débito soma no saldo devedor, crédito subtrai
      return { mes, debito: mv.deb, credito: mv.cred, saldoFinal: saldo };
    });
  };

  const contas: ContaBalancete[] = [];
  for (const [conta, inf] of info) {
    const nivel = inf.classif.split(".").length;
    if (inf.sintetica) {
      const a = acumSint.get(inf.classif);
      if (!a) continue; // sintética sem nenhuma analítica movimentada: some
      const semNada =
        a.saldoIni === 0 && [...a.meses.values()].every((m) => m.deb === 0 && m.cred === 0);
      if (semNada) continue;
      contas.push({
        conta,
        classif: inf.classif,
        nivel,
        descricao: inf.descr ?? String(conta),
        sintetica: true,
        natureza: inf.natureza,
        saldoInicial: a.saldoIni,
        meses: montarMeses(a.saldoIni, a.meses),
      });
    } else {
      if (!contasEnvolvidas.has(conta)) continue;
      const saldoIni = saldoInicial.get(conta) ?? 0;
      const mov = movPorConta.get(conta);
      const semNada =
        saldoIni === 0 && (!mov || [...mov.values()].every((m) => m.deb === 0 && m.cred === 0));
      if (semNada) continue;
      contas.push({
        conta,
        classif: inf.classif,
        nivel,
        descricao: inf.descr ?? String(conta),
        sintetica: false,
        natureza: inf.natureza,
        saldoInicial: saldoIni,
        meses: montarMeses(saldoIni, mov),
      });
    }
  }
  contas.sort((a, b) => a.classif.localeCompare(b.classif) || a.conta - b.conta);

  return { empresa: empresaInfo, mesesLabels: meses, contas };
}

/** Tolerância em reais para o fechamento (abaixo disso é arredondamento). */
const TOL_FECHA = 1;

/**
 * Resume o balancete coletado num BALANCETE DE VERIFICAÇÃO — por conta: saldo
 * anterior, débito e crédito do período e saldo atual, na árvore do plano. É a
 * matéria-prima da tela Balancete; a Análise usa o mesmo `BalanceteContabil`.
 *
 * O coletor já traz só contas com saldo ou movimento (as zeradas somem), então
 * aqui não há mais o que filtrar — mostra exatamente o que teve vida no período.
 */
export function resumirBalanceteVerificacao(
  bal: BalanceteContabil,
  inicio: string,
  fim: string
): BalanceteContabilResp {
  const linhas: BalanceteContabilLinha[] = bal.contas.map((c) => {
    const debito = c.meses.reduce((s, m) => s + m.debito, 0);
    const credito = c.meses.reduce((s, m) => s + m.credito, 0);
    const saldoAtual = c.meses.at(-1)?.saldoFinal ?? c.saldoInicial;
    return {
      conta: c.conta,
      classif: c.classif,
      nivel: c.nivel,
      descricao: c.descricao,
      sintetica: c.sintetica,
      natureza: c.natureza,
      saldoAnterior: c.saldoInicial,
      debito,
      credito,
      saldoAtual,
    };
  });

  // Totais só das analíticas (as sintéticas somam as filhas — duplicariam).
  const t = {
    saldoAnteriorDevedor: 0,
    saldoAnteriorCredor: 0,
    debito: 0,
    credito: 0,
    saldoAtualDevedor: 0,
    saldoAtualCredor: 0,
    fecha: false,
  };
  for (const l of linhas) {
    if (l.sintetica) continue;
    if (l.saldoAnterior >= 0) t.saldoAnteriorDevedor += l.saldoAnterior;
    else t.saldoAnteriorCredor += -l.saldoAnterior;
    t.debito += l.debito;
    t.credito += l.credito;
    if (l.saldoAtual >= 0) t.saldoAtualDevedor += l.saldoAtual;
    else t.saldoAtualCredor += -l.saldoAtual;
  }
  t.fecha =
    Math.abs(t.debito - t.credito) <= TOL_FECHA &&
    Math.abs(t.saldoAtualDevedor - t.saldoAtualCredor) <= TOL_FECHA;

  const nivelMax = linhas.reduce((mx, l) => Math.max(mx, l.nivel), 1);

  return {
    empresa: bal.empresa,
    periodo: { inicio, fim, meses: bal.mesesLabels },
    linhas,
    nivelMax,
    totais: t,
    atipicas: validarBalancete(bal).anomalias,
  };
}
