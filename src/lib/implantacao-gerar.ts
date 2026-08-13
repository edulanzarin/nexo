import type { LinhaCasada, ParamsGeracao } from "./implantacao-tipos";
import { complementoQuestor, dataQuestor, montarArquivoNli, valorQuestor } from "./nli";

/**
 * Gera o arquivo de importação de lançamentos contábeis do Questor a partir do
 * balancete casado. NÃO escreve no banco — devolve o texto que o contador importa
 * no Questor (layout "Layout Importação Lançamento Contábeis"; formato em [[nli]]).
 *
 * Cada conta com saldo de abertura vira UMA linha, lançada contra a conta
 * transitória de implantação ("Saldos a Implantar"):
 *  - saldo DEVEDOR  → débito na conta, crédito na transitória;
 *  - saldo CREDOR   → débito na transitória, crédito na conta.
 * Como o balancete fecha (Σ devedores = Σ credores), a transitória zera no fim.
 */

/** Tolerância em reais para dizer que a transitória zerou. */
const TOL = 1;

export interface ResultadoGeracao {
  /** Conteúdo do arquivo (uma linha por lançamento, terminador CRLF). */
  arquivo: string;
  /** Quantas linhas (lançamentos) foram geradas. */
  linhas: number;
  /** Σ dos saldos devedores lançados. */
  totalDebito: number;
  /** Σ dos saldos credores lançados. */
  totalCredito: number;
  /** A transitória zera? (|Σdev − Σcred| < tolerância). */
  transitoriaZera: boolean;
  /** Linhas puladas por não terem conta de destino (precisam de de-para). */
  semConta: LinhaCasada[];
}

export function gerarArquivoImplantacao(
  casadas: LinhaCasada[],
  params: ParamsGeracao
): ResultadoGeracao {
  const data = dataQuestor(params.data);
  const semConta: LinhaCasada[] = [];
  const linhas: string[] = [];
  let totalDebito = 0;
  let totalCredito = 0;

  for (const c of casadas) {
    // Saldo zero não gera lançamento.
    if (Math.abs(c.origem.saldo) < 0.005) continue;
    if (c.conta == null || c.natureza == null) {
      semConta.push(c);
      continue;
    }

    const devedor = c.natureza === "D";
    const contaDeb = devedor ? c.conta : params.contaImplantacao;
    const contaCred = devedor ? params.contaImplantacao : c.conta;
    if (devedor) totalDebito += c.origem.saldo;
    else totalCredito += c.origem.saldo;

    linhas.push(
      [
        "C",
        params.empresa,
        params.estab,
        data,
        contaDeb,
        contaCred,
        params.codigoHistorico,
        complementoQuestor(params.complemento ?? ""),
        valorQuestor(c.origem.saldo),
      ].join(";")
    );
  }

  return {
    arquivo: montarArquivoNli(linhas),
    linhas: linhas.length,
    totalDebito,
    totalCredito,
    transitoriaZera: Math.abs(totalDebito - totalCredito) < TOL,
    semConta,
  };
}
