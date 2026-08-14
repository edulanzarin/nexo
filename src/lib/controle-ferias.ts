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
 */

/** Janela em que um período "a vencer" acende o alerta (limite a ≤ N dias). */
const A_VENCER_DIAS = 120;

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
 *  Exportado para o Painel do DP reusar a mesma regra num agregado office-wide. */
export function periodosEmAberto(admissao: string, ref: string, gozados: string[]): PeriodoAberto[] {
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

  // Empregados CLT ativos na referência, com admissão.
  const ativosQ = await client.query<{ contrato: number; funcionario: string; admissao: string }>(
    `select f.codigofunccontr contrato,
            coalesce(nullif(btrim(f.nomefunc), ''), 'Contrato ' || f.codigofunccontr) funcionario,
            to_char(f.dataadm, 'YYYY-MM-DD') admissao
       from funcionario f
      where f.codigoempresa = $1 and f.dataadm is not null
        and (f.datadem is null or f.datadem > $2)
        and f.categoria = '01'`,
    [empresa, referencia]
  );

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

  const funcionarios: FeriasFuncionario[] = ativosQ.rows.map((a) => {
    const abertos = periodosEmAberto(a.admissao, referencia, gozadosPorContrato.get(a.contrato) ?? []);
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
    },
    funcionarios,
  };
}
