import { complementoQuestor, dataQuestor, linhaNli, montarArquivoNli, valorQuestor } from "./nli";

/**
 * Gera o arquivo de importação do Questor a partir dos lançamentos da
 * Conciliação. NÃO escreve no banco — devolve o texto que o contador importa
 * (mesmo layout `.nli` da Implantação, ver [[nli]]).
 *
 * Diferente da Implantação, aqui cada lançamento JÁ é dupla partida completa: a
 * conta do banco de um lado e a contrapartida (da regra ou escolhida à mão) do
 * outro. Então não há transitória — cada lançamento pronto vira uma linha, com a
 * SUA própria data (a do movimento no extrato), não uma data de lote.
 */

export interface LancamentoNli {
  /** Data do lançamento em ISO "YYYY-MM-DD". */
  data: string;
  contaDebito: number;
  contaCredito: number;
  /** Texto do complemento do histórico (histórico da regra ou a descrição). */
  complemento: string;
  /** Valor em módulo. */
  valor: number;
}

export interface ParamsConciliacao {
  empresa: number;
  estab: number;
  /** Código do histórico padrão do Questor (o complemento é por lançamento). */
  codigoHistorico: number;
}

export interface ResultadoConciliacao {
  /** Conteúdo do arquivo (uma linha por lançamento, terminador CRLF). */
  arquivo: string;
  /** Quantas linhas foram geradas. */
  linhas: number;
  /** Σ dos débitos e créditos — iguais, porque cada linha é uma dupla partida. */
  total: number;
}

export function gerarArquivoConciliacao(
  lancamentos: LancamentoNli[],
  params: ParamsConciliacao
): ResultadoConciliacao {
  const linhas: string[] = [];
  let total = 0;

  for (const l of lancamentos) {
    if (Math.abs(l.valor) < 0.005) continue;
    total += Math.abs(l.valor);
    linhas.push(
      linhaNli([
        "C",
        params.empresa,
        params.estab,
        dataQuestor(l.data),
        l.contaDebito,
        l.contaCredito,
        params.codigoHistorico,
        complementoQuestor(l.complemento ?? ""),
        valorQuestor(l.valor),
      ])
    );
  }

  return {
    arquivo: montarArquivoNli(linhas),
    linhas: linhas.length,
    total,
  };
}
