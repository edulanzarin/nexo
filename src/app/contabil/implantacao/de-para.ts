import type { Tom } from "@/componentes/primitivos/indicador";
import { pct } from "@/lib/format";
import type { OrigemCasamento, StatusCasamento } from "@/lib/implantacao-tipos";

/**
 * Como o de-para se lê nas duas abas da Implantação (saldos e patrimonial).
 * Uma fonte só para a linha, o filtro, o detalhe e a planilha exportada.
 */
export const SITUACAO_DEPARA: Record<StatusCasamento, { rotulo: string; tom: Tom }> = {
  casada: { rotulo: "Casada", tom: "ok" },
  duvidosa: { rotulo: "Confira", tom: "atencao" },
  sem_conta: { rotulo: "Sem conta", tom: "perigo" },
};

/** "Confira 72%": a confiança só aparece onde há o que conferir. */
export function rotuloSituacao(status: StatusCasamento, confianca: number): string {
  const s = SITUACAO_DEPARA[status].rotulo;
  return status === "duvidosa" ? `${s} ${pct(confianca * 100, 0)}` : s;
}

export const VIA_DEPARA: Record<OrigemCasamento, string> = {
  override: "Pelo de-para salvo nesta empresa",
  classif: "Pela classificação",
  descricao: "Pela descrição",
  manual: "Escolhida à mão",
};
