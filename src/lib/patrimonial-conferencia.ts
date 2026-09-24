import { brl } from "./format";
import type { BemLido, ContaBens, TotaisBens } from "./patrimonial-tipos";

/**
 * Conferência da leitura contra o que o PRÓPRIO relatório imprime. É o que
 * separa esta leitura de colar o PDF numa IA: lá, pegar a coluna do residual no
 * lugar da depreciação acumulada passa despercebido; aqui a soma deixa de bater
 * com o total da conta e a tela aponta.
 *
 * Pura e sem servidor: a tela recalcula a cada edição de bem.
 */

/** Diferença de arredondamento tolerada, em reais. */
export const TOLERANCIA = 0.05;

export interface ConferenciaConta {
  chave: string;
  bens: number;
  /** Somado dos bens como estão agora (lidos e editados). */
  lido: TotaisBens;
  /** Impresso no relatório; null quando o layout não traz. */
  relatorio: TotaisBens | null;
  /** null quando não há total impresso para comparar. */
  confere: boolean | null;
}

export interface ConferenciaPatrimonial {
  contas: ConferenciaConta[];
  lido: TotaisBens;
  relatorio: TotaisBens | null;
  confere: boolean | null;
}

function somar(bens: BemLido[]): TotaisBens {
  let valor = 0;
  let depreciacao = 0;
  for (const b of bens) {
    valor += b.valor;
    depreciacao += b.depreciacao;
  }
  return { valor, depreciacao };
}

function bate(lido: TotaisBens, relatorio: TotaisBens | null): boolean | null {
  if (!relatorio) return null;
  return (
    Math.abs(lido.valor - relatorio.valor) <= TOLERANCIA &&
    Math.abs(lido.depreciacao - relatorio.depreciacao) <= TOLERANCIA
  );
}

export function conferirPatrimonial(leitura: {
  contas: ContaBens[];
  bens: BemLido[];
  totalGeral: TotaisBens | null;
}): ConferenciaPatrimonial {
  const contas = leitura.contas.map((c) => {
    const bens = leitura.bens.filter((b) => b.conta === c.chave);
    const lido = somar(bens);
    return { chave: c.chave, bens: bens.length, lido, relatorio: c.total, confere: bate(lido, c.total) };
  });
  const lido = somar(leitura.bens);
  // Sem total geral impresso, a soma dos totais das contas faz o papel dele.
  const relatorio =
    leitura.totalGeral ??
    (leitura.contas.length && leitura.contas.every((c) => c.total)
      ? {
          valor: leitura.contas.reduce((s, c) => s + (c.total?.valor ?? 0), 0),
          depreciacao: leitura.contas.reduce((s, c) => s + (c.total?.depreciacao ?? 0), 0),
        }
      : null);
  return { contas, lido, relatorio, confere: bate(lido, relatorio) };
}

/** O que está errado num bem, para a linha avisar; null quando está bom. */
export function avisoDoBem(b: BemLido): string | null {
  if (!(b.valor > 0)) return "Bem sem valor";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.aquisicao)) return "Data de aquisição inválida";
  if (b.depreciacao < 0 || b.depreciacao > b.valor + TOLERANCIA) {
    return "Depreciação acumulada maior que o valor do bem";
  }
  if (b.taxa < 0 || b.taxa > 100) return "Taxa fora de 0 a 100%";
  if (b.residual != null && Math.abs(b.valor - b.depreciacao - b.residual) > TOLERANCIA) {
    return `No relatório o residual é ${brl(b.residual)}, e valor menos depreciação dá ${brl(b.valor - b.depreciacao)}`;
  }
  return null;
}
