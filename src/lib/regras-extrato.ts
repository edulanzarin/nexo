import type { SeloFolha } from "./folha-casamento";

/**
 * Casamento das descrições do extrato bancário com as regras cadastradas.
 *
 * A descrição vem do banco em formato imprevisível ("PAGTO MAGALHÃES COM.
 * LTDA", "TED  RECEBIDA - MAGALHAES"), então tudo é normalizado antes de
 * comparar: sem acento, maiúsculas, espaços colapsados.
 */

export type TipoRegra = "exato" | "parcial";
/** Sentido do dinheiro: entrou (recebimento) ou saiu (pagamento) da conta. */
export type Sentido = "recebimento" | "pagamento";

export interface RegraExtrato {
  id: number;
  termo: string;
  termoOriginal: string;
  tipo: TipoRegra;
  contaPagamento: number | null;
  contaRecebimento: number | null;
  historico: string | null;
  ativo: boolean;
}

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quão específica é a regra. Exato sempre ganha de parcial; entre parciais,
 * o termo mais longo ganha — assim cadastrar "MAGA" genérico e depois
 * "MAGALHAES COMERCIO" faz o segundo prevalecer sem gerenciar ordem.
 */
export function especificidade(r: RegraExtrato): number {
  return (r.tipo === "exato" ? 1_000_000 : 0) + r.termo.length;
}

export interface Casamento {
  regra: RegraExtrato;
  conta: number | null;
  /** Outra regra empatou em especificidade — vale conferir o cadastro. */
  ambiguo: boolean;
}

/**
 * Acha a regra que vale para uma descrição. Devolve `null` quando nenhuma
 * casa; devolve com `conta: null` quando a regra casa mas não define conta
 * para aquele sentido (ex.: só trata pagamento e veio um recebimento) — são
 * situações diferentes e a tela mostra cada uma de um jeito.
 */
export function casar(
  descricao: string,
  sentido: Sentido,
  regras: RegraExtrato[]
): Casamento | null {
  const alvo = normalizar(descricao);
  if (!alvo) return null;

  const candidatas = regras.filter((r) => {
    if (!r.ativo) return false;
    return r.tipo === "exato" ? alvo === r.termo : alvo.includes(r.termo);
  });
  if (!candidatas.length) return null;

  let melhor = candidatas[0];
  let empate = false;
  for (const r of candidatas.slice(1)) {
    const d = especificidade(r) - especificidade(melhor);
    if (d > 0) {
      melhor = r;
      empate = false;
    } else if (d === 0) {
      empate = true;
    }
  }

  const conta = sentido === "pagamento" ? melhor.contaPagamento : melhor.contaRecebimento;
  return { regra: melhor, conta, ambiguo: empate };
}

export interface Transacao {
  data: string;
  descricao: string;
  /** Positivo = entrou na conta; negativo = saiu. */
  valor: number;
}

export interface LancamentoGerado {
  data: string;
  descricao: string;
  valor: number;
  sentido: Sentido;
  contaDebito: number | null;
  contaCredito: number | null;
  historico: string;
  regraId: number | null;
  /** Por que não dá para lançar: sem regra, ou regra sem conta para o sentido. */
  pendencia: "sem_regra" | "sem_conta" | null;
  ambiguo: boolean;
  /**
   * Quem é o favorecido na folha, quando é gente da casa. NÃO decide conta
   * nenhuma — é contexto para quem decide: comissão a funcionário e a
   * não-funcionário não caem na mesma conta, e hoje isso se descobre caçando.
   * Preenchido depois das regras, no servidor, por [[contabil-funcionarios]];
   * ausente quando ninguém casou.
   */
  pessoa?: SeloFolha | null;
}

/**
 * Transforma as transações do extrato em lançamentos de partida dobrada.
 * Dinheiro que entra debita o banco (ativo aumenta) e credita a contrapartida;
 * dinheiro que sai faz o inverso.
 */
export function gerarLancamentos(
  transacoes: Transacao[],
  contaBanco: number,
  regras: RegraExtrato[]
): LancamentoGerado[] {
  return transacoes.map((t) => {
    const sentido: Sentido = t.valor >= 0 ? "recebimento" : "pagamento";
    const m = casar(t.descricao, sentido, regras);
    const contra = m?.conta ?? null;

    return {
      data: t.data,
      descricao: t.descricao,
      valor: Math.abs(t.valor),
      sentido,
      contaDebito: sentido === "recebimento" ? contaBanco : contra,
      contaCredito: sentido === "recebimento" ? contra : contaBanco,
      historico: m?.regra.historico?.trim() || t.descricao,
      regraId: m?.regra.id ?? null,
      pendencia: !m ? "sem_regra" : contra == null ? "sem_conta" : null,
      ambiguo: m?.ambiguo ?? false,
    };
  });
}
