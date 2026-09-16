/**
 * QUAIS COMPETÊNCIAS O FECHAMENTO MEDE, dado o período da barra e o dia de hoje.
 *
 * Puro e sem banco de propósito: é a regra que decide de que mês são os números
 * da aba, e regra de calendário erra calado na virada do ano. Aqui ela cabe num
 * teste ([[contabil-fechamento-competencias.test]]).
 *
 * A regra: a competência de REFERÊNCIA é a última do período que já ENCERROU. O
 * lançamento de encerramento entra depois de o mês terminar, em geral no mês
 * seguinte, então medir o mês corrente é cobrar trabalho que ainda não podia
 * existir — em setembro a tela mostrava o escritório inteiro em aberto, 0%
 * fechado, e cada pessoa tinha que recuar o período à mão para ler o número que
 * importa.
 */

/** Dia "YYYY-MM-DD" → a competência dele, "YYYY-MM-01". */
export const competenciaDe = (iso: string) => iso.slice(0, 7) + "-01";

/** A competência n meses adiante (negativo para trás). */
export function competenciaDeslocada(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/** Último dia da competência. */
export function fimDaCompetencia(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
}

/** As competências que o intervalo toca, mês pela metade incluído. */
function competenciasEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let mes = competenciaDe(inicio);
  const ultima = competenciaDe(fim);
  while (mes <= ultima) {
    out.push(mes);
    mes = competenciaDeslocada(mes, 1);
  }
  return out;
}

export interface CompetenciasFechamento {
  /** Competências da fita, em ordem. */
  meses: string[];
  /** A competência dos indicadores: a última já encerrada. */
  referencia: string;
  /** As do período que ainda não encerraram — ficam na fita, fora dos números. */
  naoEncerradas: string[];
  /**
   * A janela que as consultas varrem: as COMPETÊNCIAS inteiras, não o intervalo
   * pedido. Mês pela metade conta inteiro (senão o fechamento lançado no dia 20
   * não aparece num período que termina no dia 9), e a competência puxada para
   * dentro precisa do dado dela.
   */
  janela: { inicio: string; fim: string };
}

export function competenciasDoFechamento(
  inicio: string,
  fim: string,
  hoje: string
): CompetenciasFechamento {
  const ultimaEncerrada = competenciaDeslocada(competenciaDe(hoje), -1);
  let meses = competenciasEntre(inicio, fim);

  // Período que não toca competência encerrada nenhuma — o padrão da barra, "do
  // dia 1º até hoje" — puxa a última encerrada para dentro em vez de deixar a
  // aba sem nada para medir.
  if (!meses.some((m) => m <= ultimaEncerrada)) meses = competenciasEntre(ultimaEncerrada, fim);

  return {
    meses,
    referencia: meses.filter((m) => m <= ultimaEncerrada).pop() ?? meses[meses.length - 1],
    naoEncerradas: meses.filter((m) => m > ultimaEncerrada),
    janela: { inicio: meses[0], fim: fimDaCompetencia(meses[meses.length - 1]) },
  };
}
