import type { BalanceteContabil } from "./balancete-contabil";
import type { ValidacaoBalancete, AnomaliaConta } from "./types";

/**
 * Validação contábil DETERMINÍSTICA do balancete — as regras que não podem ficar
 * a cargo da IA. Roda sobre os saldos calculados a partir dos lançamentos.
 *
 * Duas regras duras + a cobertura:
 *  1. O balancete FECHA: soma dos saldos das analíticas ≈ 0 (Σ devedores =
 *     Σ credores). Se não fecha, há erro de dado (partida sem contrapartida).
 *  2. SINAL vs NATUREZA: conta devedora não pode ter saldo credor (ex.: Caixa
 *     ou Banco negativo é impossível) e conta credora não pode ter saldo devedor
 *     (ex.: Fornecedor devedor = pagou a maior ou lançou errado). A natureza vem
 *     de `natursaldo` — é a regra da própria empresa, não suposição.
 *  3. COBERTURA: quantos meses do período realmente têm movimento, e se havia
 *     saldo antes — pra IA não confundir "empresa aberta há 4 meses" ou "mês sem
 *     movimento" com queda.
 */

/** Tolerância em reais: abaixo disso é arredondamento, não violação. */
const TOL = 1;

/** Quantas anomalias no máximo (as de maior valor). */
const MAX_ANOMALIAS = 60;

/**
 * Conta REDUTORA (contra): o Questor deste escritório marca com o prefixo "(-)"
 * na descrição (ex.: "(-) Prejuízos do Exercício", "(-) Depreciação Acumulada",
 * "(-) Lucros Distribuídos"). Por definição ela carrega saldo de sinal OPOSTO ao
 * do grupo — um prejuízo é devedor dentro do PL credor —, então "sinal vs
 * natureza" não se aplica: o saldo invertido é o esperado, não anomalia.
 */
export const ehContaRedutora = (descricao: string) =>
  descricao.trimStart().startsWith("(-)");

export function validarBalancete(bal: BalanceteContabil): ValidacaoBalancete {
  const analiticas = bal.contas.filter((c) => !c.sintetica);

  // ── 1. Fechamento: Σ saldo final das analíticas deve ser ~0 ──
  // (saldo = deb − cred; devedores positivos, credores negativos → soma zero.)
  const difFechamento = analiticas.reduce(
    (s, c) => s + (c.meses.at(-1)?.saldoFinal ?? 0),
    0
  );
  const fecha = Math.abs(difFechamento) <= TOL;

  // ── 2. Sinal vs natureza (no saldo de fechamento) ──
  // Normaliza pela natureza: saldoNatural > 0 = normal; < 0 = sinal atípico.
  const anomalias: AnomaliaConta[] = [];
  for (const c of analiticas) {
    if (ehContaRedutora(c.descricao)) continue; // saldo oposto é o esperado
    const saldoFinal = c.meses.at(-1)?.saldoFinal ?? 0;
    const saldoNatural = c.natureza === "C" ? -saldoFinal : saldoFinal;
    if (saldoNatural < -TOL) {
      anomalias.push({
        conta: c.conta,
        classif: c.classif,
        descricao: c.descricao,
        natureza: c.natureza,
        saldoFinal,
      });
    }
  }
  anomalias.sort((a, b) => Math.abs(b.saldoFinal) - Math.abs(a.saldoFinal));

  // ── 3. Cobertura ──
  let mesesComMovimento = 0;
  let primeiroMesComDado: string | null = null;
  for (const label of bal.mesesLabels) {
    const temMov = bal.contas.some((c) => {
      const m = c.meses.find((x) => x.mes === label);
      return m ? m.debito > 0 || m.credito > 0 : false;
    });
    if (temMov) {
      mesesComMovimento++;
      if (!primeiroMesComDado) primeiroMesComDado = label;
    }
  }
  const temSaldoInicial = bal.contas.some((c) => Math.abs(c.saldoInicial) > TOL);

  return {
    fecha,
    difFechamento,
    anomalias: anomalias.slice(0, MAX_ANOMALIAS),
    cobertura: {
      mesesSolicitados: bal.mesesLabels.length,
      mesesComMovimento,
      primeiroMesComDado,
      temSaldoInicial,
    },
  };
}
