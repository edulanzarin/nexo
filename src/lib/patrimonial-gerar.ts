import { dataQuestor, valorQuestor } from "./nli";
import type { BemLido } from "./patrimonial-tipos";

/**
 * Gera o arquivo de importação do patrimonial do Questor a partir dos bens
 * lidos. NÃO escreve no banco: devolve o texto que o contador importa.
 *
 * O layout é o do modelo que o Questor exporta ("MODELO ARQUIVO PATRIMONIAL"):
 * `;` entre campos, vírgula decimal sem milhar, data DD/MM/AAAA, CRLF. O que
 * cada campo recebe foi conferido contra uma implantação já importada, lendo o
 * que o Questor gravou em `patbem`, `patbemcontacontabil` e `patcfgbem`:
 *  - Conta Contábil é a conta DO BEM (Veículos), não a da depreciação;
 *  - Encargo Acumulado é a depreciação acumulada, não o valor residual;
 *  - Percentual de Encargo é a taxa anual como está, 0 inclusive;
 *  - ITEM vai 1 em toda linha, e o Questor numera os bens em sequência sozinho;
 *  - Data Final vai vazia, e o Questor grava a data final nula.
 * O encoding (Windows-1252, como o modelo) fica com quem baixa: ver
 * `bytesWindows1252`.
 */

export const CABECALHO_PATRIMONIAL = [
  "ITEM",
  "Conta Contábil",
  "Descrição",
  "Quantidade",
  "Valor do Bem",
  "Data Aquisição",
  "Encargo Acumulado",
  "Percentual de Encargo",
  "Data Final",
];

/** Tamanho de `patbem.descrisao` no Questor. */
const TAM_DESCRICAO = 300;

/** Sem separador nem quebra: o importador não entende aspas. */
function descricaoQuestor(texto: string): string {
  return texto.replace(/[;"\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, TAM_DESCRICAO);
}

/** 20 → "20", 12.5 → "12,5": a taxa vai como número, sem casas sobrando. */
function numeroQuestor(v: number): string {
  return String(Number(v.toFixed(4))).replace(".", ",");
}

export interface ResultadoArquivoPatrimonial {
  /** Conteúdo do arquivo, cabeçalho incluso, CRLF em toda linha. */
  arquivo: string;
  /** Quantos bens viraram linha. */
  linhas: number;
  valor: number;
  depreciacao: number;
}

/**
 * `contaDe` resolve a conta de origem do bem para a conta do Questor. Bem sem
 * conta não é pulado em silêncio: faltar um bem no arquivo é o erro que ninguém
 * percebe depois de importar.
 */
export function gerarArquivoPatrimonial(
  bens: BemLido[],
  contaDe: (contaOrigem: string) => number | null
): ResultadoArquivoPatrimonial {
  const linhas = [CABECALHO_PATRIMONIAL.join(";")];
  let valor = 0;
  let depreciacao = 0;

  for (const b of bens) {
    const conta = contaDe(b.conta);
    if (conta == null) {
      throw new Error(`O bem ${b.codigo} (${b.descricao}) está numa conta sem correspondência no Questor`);
    }
    valor += b.valor;
    depreciacao += b.depreciacao;
    linhas.push(
      [
        "1",
        conta,
        descricaoQuestor(b.descricao),
        numeroQuestor(b.quantidade),
        valorQuestor(b.valor),
        dataQuestor(b.aquisicao),
        valorQuestor(b.depreciacao),
        numeroQuestor(b.taxa),
        "",
      ].join(";")
    );
  }

  return { arquivo: linhas.join("\r\n") + "\r\n", linhas: bens.length, valor, depreciacao };
}
