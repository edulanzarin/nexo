import type { LancamentoGerado } from "./regras-extrato";

/**
 * A prévia de um extrato processado e seu resumo. Vive no estado da seção
 * (sobrevive à troca de abas) e é compartilhada entre os controles da barra —
 * que processam o arquivo — e a página, que exibe KPIs e lançamentos.
 */
export interface Resumo {
  total: number;
  prontos: number;
  semRegra: number;
  semConta: number;
  ambiguos: number;
  entradas: number;
  saidas: number;
}

export interface Previa {
  arquivo: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  inicio: string | null;
  fim: string | null;
  saldoConfere: boolean | null;
  contaBanco: { conta: number; descricao: string | null; apelido: string | null };
  resumo: Resumo;
  lancamentos: LancamentoGerado[];
}

/** Conta escolhida à mão para uma linha, só nesta importação. */
export type Ajustes = Record<number, number>;

export function resumir(lancamentos: LancamentoGerado[], ajustes: Ajustes): Resumo {
  const resolvido = (l: LancamentoGerado, i: number) => !l.pendencia || ajustes[i] != null;
  return {
    total: lancamentos.length,
    prontos: lancamentos.filter(resolvido).length,
    semRegra: lancamentos.filter((l, i) => l.pendencia === "sem_regra" && ajustes[i] == null).length,
    semConta: lancamentos.filter((l, i) => l.pendencia === "sem_conta" && ajustes[i] == null).length,
    ambiguos: lancamentos.filter((l) => l.ambiguo).length,
    entradas: lancamentos
      .filter((l) => l.sentido === "recebimento")
      .reduce((a, b) => a + b.valor, 0),
    saidas: -lancamentos.filter((l) => l.sentido === "pagamento").reduce((a, b) => a + b.valor, 0),
  };
}
