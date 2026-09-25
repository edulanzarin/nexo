import { PoolClient } from "pg";
import type { ControleFeriasResp, FeriasFuncionario, FeriasSituacao } from "./types";

/**
 * CONTROLE DE FÉRIAS — quem tem férias vencidas (risco de pagar em DOBRO) ou a
 * vencer. O Questor não expõe (no schema conhecido) uma tabela de saldo de período
 * aquisitivo, então isto DERIVA os períodos de `dataadm` e cruza com os gozados em
 * `reciboferias` (`datainicial` = início do aquisitivo). Ver [[Módulo de folha e
 * eSocial do Questor]].
 *
 * ── A regra trabalhista (CLT) ────────────────────────────────────────────────
 * A cada 12 meses de trabalho o empregado adquire 30 dias de férias (período
 * AQUISITIVO). A empresa tem os 12 meses seguintes (período CONCESSIVO) para
 * concedê-las; passou disso sem gozo, paga em DOBRO. Logo, para o período
 * aquisitivo que se completou em D, o limite de concessão é D + 12 meses.
 *
 * ── Ressalvas (heurística a validar) ─────────────────────────────────────────
 * Aproximação gerencial: NÃO considera afastamentos (suspendem/zeram o aquisitivo),
 * faltas (reduzem/perdem o direito), nem férias parciais/coletivas — um período
 * com qualquer recibo é tratado como concedido. Só empregado CLT (`categoria='01'`).
 * A tela mostra a memória (admissão, período crítico, últimas férias) para conferir.
 *
 * ── Quem conta, e desde quando ───────────────────────────────────────────────
 * Sem data de demissão não basta para ser ativo. Em set/2026, 3,3 mil dos 8 mil
 * contratos CLT "sem demissão" do escritório não tinham folha havia mais de 120
 * dias (empresa que saiu, contrato duplicado que nunca teve folha), e eram quase
 * todas as 1.469 "férias vencidas" do painel; com a folha como prova de vida,
 * sobraram 191. Admissão recente entra mesmo sem folha: a primeira ainda não saiu.
 *
 * A primeira folha do contrato no Questor é o horizonte. Período cujo prazo de
 * concessão venceu antes dela aconteceu fora do Questor, e a falta de recibo lá
 * não prova que não houve férias: admitido em 1988 aparecia com 33 períodos
 * vencidos. Com o horizonte, os casos de 5+ períodos caíram de 65 para 3.
 */

/** Janela em que um período "a vencer" acende o alerta (limite a ≤ N dias). */
const A_VENCER_DIAS = 120;

/** Sem folha calculada há mais que isto (e sem admissão recente), o contrato não conta. */
export const DIAS_SEM_FOLHA = 120;

/**
 * A primeira e a última folha de cada contrato, para juntar a `funcionario f`.
 * `funcpercalculo` é o cálculo de um funcionário num período; provisão (70/71)
 * e transferência (80) ficam de fora porque não são folha paga. `condEmpresa`
 * recorta a subconsulta (`fpc.codigoempresa`) pelo mesmo escopo da consulta.
 */
export function sqlFolhaDoContrato(condEmpresa: string): string {
  return `left join (
      select fpc.codigoempresa, fpc.codigofunccontr,
             to_char(min(pc.datafinalfolha), 'YYYY-MM-DD') primeira,
             max(pc.datafinalfolha) ultima
        from funcpercalculo fpc
        join periodocalculo pc
          on pc.codigoempresa = fpc.codigoempresa and pc.codigopercalculo = fpc.codigopercalculo
       where pc.codigotipocalc not in (70, 71, 80)${condEmpresa}
       group by 1, 2
    ) fo on fo.codigoempresa = f.codigoempresa and fo.codigofunccontr = f.codigofunccontr`;
}

/** O contrato tem folha recente ou foi admitido há pouco. `ref` é o placeholder da referência. */
export function sqlComFolha(ref: string): string {
  return `(fo.ultima >= ${ref}::date - ${DIAS_SEM_FOLHA} or f.dataadm >= ${ref}::date - ${DIAS_SEM_FOLHA})`;
}

/** ISO "YYYY-MM-DD" + n meses (em UTC, para não escorregar por fuso). */
function addMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
}

/** Dias entre duas datas ISO (a − b). */
function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
}

interface PeriodoAberto {
  inicio: string;
  fim: string;
  limite: string;
  diasParaLimite: number;
  vencido: boolean;
}

/** Deriva os períodos aquisitivos completos e não gozados de um funcionário.
 *  Exportado para o Painel do DP reusar a mesma regra num agregado office-wide.
 *  `horizonte` é a primeira folha do contrato no Questor: período cujo limite de
 *  concessão caiu antes dela não entra (aconteceu fora do alcance do banco). */
export function periodosEmAberto(
  admissao: string,
  ref: string,
  gozados: string[],
  horizonte: string | null = null
): PeriodoAberto[] {
  const abertos: PeriodoAberto[] = [];
  // k avança enquanto o período aquisitivo k já se completou até a referência.
  for (let k = 0; k < 60; k++) {
    const inicio = addMeses(admissao, k * 12);
    const fim = addMeses(admissao, (k + 1) * 12);
    if (diffDias(fim, ref) > 0) break; // período ainda não completou
    // Gozado se há recibo cujo início do aquisitivo cai dentro deste período.
    const gozado = gozados.some((g) => diffDias(g, inicio) >= 0 && diffDias(g, fim) < 0);
    if (gozado) continue;
    const limite = addMeses(fim, 12); // fim do concessivo
    if (horizonte && limite < horizonte) continue;
    const diasParaLimite = diffDias(limite, ref);
    abertos.push({ inicio, fim, limite, diasParaLimite, vencido: diasParaLimite < 0 });
  }
  return abertos;
}

export async function montarControleFerias(
  client: PoolClient,
  empresa: number,
  referencia: string
): Promise<ControleFeriasResp> {
  const nomeQ = await client.query<{ nome: string }>(
    `select coalesce(nomeempresa, '') nome from empresa where codigoempresa = $1`,
    [empresa]
  );
  const nome = nomeQ.rows[0]?.nome ?? String(empresa);

  // Empregados CLT sem demissão na referência, com a folha de cada um: quem não
  // tem folha recente fica de fora e só entra na contagem de `semFolha`.
  const ativosQ = await client.query<{
    contrato: number;
    funcionario: string;
    admissao: string;
    primeira: string | null;
    com_folha: boolean;
  }>(
    `select f.codigofunccontr contrato,
            coalesce(nullif(btrim(f.nomefunc), ''), 'Contrato ' || f.codigofunccontr) funcionario,
            to_char(f.dataadm, 'YYYY-MM-DD') admissao,
            fo.primeira,
            coalesce(${sqlComFolha("$2")}, false) com_folha
       from funcionario f
       ${sqlFolhaDoContrato(" and fpc.codigoempresa = $1")}
      where f.codigoempresa = $1 and f.dataadm is not null
        and (f.datadem is null or f.datadem > $2)
        and f.categoria = '01'`,
    [empresa, referencia]
  );
  const ativos = ativosQ.rows.filter((a) => a.com_folha);
  const semFolha = ativosQ.rows.length - ativos.length;

  // Férias gozadas por contrato: início do período aquisitivo e fim do gozo.
  const recibosQ = await client.query<{ contrato: number; aquis: string | null; fim_gozo: string | null }>(
    `select codigofunccontr contrato,
            to_char(datainicial, 'YYYY-MM-DD') aquis,
            to_char(datafinalferias, 'YYYY-MM-DD') fim_gozo
       from reciboferias where codigoempresa = $1`,
    [empresa]
  );
  const gozadosPorContrato = new Map<number, string[]>();
  const ultimoGozoPorContrato = new Map<number, string>();
  for (const r of recibosQ.rows) {
    if (r.aquis) {
      const arr = gozadosPorContrato.get(r.contrato) ?? [];
      arr.push(r.aquis);
      gozadosPorContrato.set(r.contrato, arr);
    }
    if (r.fim_gozo) {
      const atual = ultimoGozoPorContrato.get(r.contrato);
      if (!atual || r.fim_gozo > atual) ultimoGozoPorContrato.set(r.contrato, r.fim_gozo);
    }
  }

  const funcionarios: FeriasFuncionario[] = ativos.map((a) => {
    const abertos = periodosEmAberto(a.admissao, referencia, gozadosPorContrato.get(a.contrato) ?? [], a.primeira);
    const periodosVencidos = abertos.filter((p) => p.vencido).length;
    // O mais crítico = o que vence primeiro (menor dias para o limite).
    const critico = abertos.length
      ? abertos.reduce((pior, p) => (p.diasParaLimite < pior.diasParaLimite ? p : pior))
      : null;

    let situacao: FeriasSituacao;
    if (periodosVencidos > 0) situacao = "vencida";
    else if (critico && critico.diasParaLimite <= A_VENCER_DIAS) situacao = "a_vencer";
    else if (abertos.length > 0) situacao = "adquirida";
    else situacao = "em_dia";

    return {
      contrato: a.contrato,
      funcionario: a.funcionario,
      admissao: a.admissao,
      situacao,
      periodosAbertos: abertos.length,
      periodosVencidos,
      aquisitivoInicio: critico?.inicio ?? null,
      aquisitivoFim: critico?.fim ?? null,
      limiteConcessao: critico?.limite ?? null,
      diasParaLimite: critico?.diasParaLimite ?? null,
      ultimasFerias: ultimoGozoPorContrato.get(a.contrato) ?? null,
    };
  });

  // Criticidade: vencida > a_vencer > adquirida > em_dia; dentro, limite mais próximo.
  const ordem: Record<FeriasSituacao, number> = { vencida: 0, a_vencer: 1, adquirida: 2, em_dia: 3 };
  funcionarios.sort(
    (x, y) =>
      ordem[x.situacao] - ordem[y.situacao] ||
      (x.diasParaLimite ?? Infinity) - (y.diasParaLimite ?? Infinity) ||
      x.funcionario.localeCompare(y.funcionario)
  );

  return {
    empresa: { codigo: empresa, nome },
    referencia,
    resumo: {
      ativos: funcionarios.length,
      comVencidas: funcionarios.filter((f) => f.situacao === "vencida").length,
      aVencer: funcionarios.filter((f) => f.situacao === "a_vencer").length,
      periodosVencidos: funcionarios.reduce((s, f) => s + f.periodosVencidos, 0),
      semFolha,
    },
    funcionarios,
  };
}
