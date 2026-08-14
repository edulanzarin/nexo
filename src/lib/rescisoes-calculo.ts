/**
 * Cálculo PURO do Controle de Rescisões — sem DB, sem `server-only`. Aqui vive a
 * regra que decide a situação de uma rescisão (vencida / vence_breve / no_prazo)
 * a partir do desligamento, do prazo (CLT art. 477) e da referência, além da
 * ordenação e do slot de aviso do cron. `rescisoes.ts` (server) só orquestra a
 * IO em volta destas funções.
 *
 * Fica separado por dois motivos que se reforçam: mantém a lógica no nível mais
 * primitivo em que ela é verdade (não depende de Questor nem de app-db), e a
 * torna testável — importar `rescisoes.ts` num teste esbarraria no `server-only`.
 * Ver [[Módulo de folha e eSocial do Questor]].
 */
import type { RescisaoItem, RescisaoSituacao, RescisoesConfig } from "./rescisoes-tipos";

/** Linha crua vinda do Questor (antes de cruzar com prazo/override). */
export interface RescisaoRaw {
  codigoempresa: number;
  empresa: string;
  contrato: number;
  funcionario: string;
  data_dem: string;
  causa: string | null;
  data_aviso: string | null;
  calculada: boolean;
  data_pgto: string | null;
}

// ── Datas (locais, sem lib; UTC para não escorregar por fuso) ────────────────

/** ISO "YYYY-MM-DD" + n dias. */
export function addDias(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}

/** Dias entre duas datas ISO (a − b). */
export function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86_400_000);
}

// ── Situação e item ──────────────────────────────────────────────────────────

/** Peso de ordenação: o que cobra ação primeiro fica no topo. */
export const PESO: Record<RescisaoSituacao, number> = {
  vencida: 0,
  vence_breve: 1,
  no_prazo: 2,
  resolvida: 3,
};

/**
 * Combina uma linha do Questor com o override manual e o prazo, derivando a
 * situação. Resolvida = tem override (o Questor nunca resolve sozinho); senão a
 * situação sai da distância do prazo até a referência: negativo = vencida,
 * dentro da antecedência = vence_breve, folgado = no_prazo.
 */
export function montarItem(
  raw: RescisaoRaw,
  referencia: string,
  cfg: RescisoesConfig,
  override: { resolvidaEm: string; observacao: string | null } | undefined
): RescisaoItem {
  const prazo = addDias(raw.data_dem, cfg.prazoDias);
  let situacao: RescisaoSituacao;
  let diasParaPrazo: number | null;
  if (override) {
    situacao = "resolvida";
    diasParaPrazo = null;
  } else {
    diasParaPrazo = diffDias(prazo, referencia);
    if (diasParaPrazo < 0) situacao = "vencida";
    else if (diasParaPrazo <= cfg.diasAntes) situacao = "vence_breve";
    else situacao = "no_prazo";
  }
  return {
    codigoempresa: raw.codigoempresa,
    empresa: raw.empresa,
    contrato: raw.contrato,
    funcionario: raw.funcionario,
    dataDesligamento: raw.data_dem,
    causa: raw.causa,
    dataAviso: raw.data_aviso,
    calculada: raw.calculada,
    pgtoPrevisto: raw.data_pgto,
    prazo,
    diasParaPrazo,
    situacao,
    resolvidaEm: override?.resolvidaEm ?? null,
    resolvidaFonte: override ? "manual" : null,
    observacao: override?.observacao ?? null,
  };
}

/**
 * Ordena a fila por criticidade: situação (peso), depois prazo mais próximo,
 * depois nome. Ordena in place e devolve a mesma lista (conveniência).
 */
export function ordenarItens(itens: RescisaoItem[]): RescisaoItem[] {
  return itens.sort(
    (a, b) =>
      PESO[a.situacao] - PESO[b.situacao] ||
      (a.diasParaPrazo ?? Infinity) - (b.diasParaPrazo ?? Infinity) ||
      a.funcionario.localeCompare(b.funcionario)
  );
}

/**
 * Slot de aviso do cron para uma rescisão pendente, ou `null` se ela ainda está
 * folgada (não avisa). Vencida (dias < 0): um aviso por dia — o slot é o próprio
 * número negativo de dias, que muda a cada dia. Dentro da antecedência: aviso
 * ÚNICO — slot fixo = diasAntes. O slot é a chave de idempotência do log.
 */
export function slotDeAviso(diasParaPrazo: number | null, diasAntes: number): number | null {
  const dias = diasParaPrazo ?? 0;
  if (dias < 0) return dias;
  if (dias <= diasAntes) return diasAntes;
  return null;
}
