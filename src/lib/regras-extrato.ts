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

/** O texto de uma linha do extrato em que a regra procura, já normalizado. */
export interface AlvoRegra {
  /** Só o histórico, a linha de cima. */
  historico: string;
  /** Histórico e complemento juntos; igual ao histórico quando não há complemento. */
  inteiro: string;
}

export function alvoDaLinha(descricao: string, complemento?: string | null): AlvoRegra {
  const historico = normalizar(descricao);
  return { historico, inteiro: complemento ? normalizar(`${descricao} ${complemento}`) : historico };
}

/** A linha inteira como texto: o histórico seguido do complemento. */
export function textoDaLinha(descricao: string, complemento?: string | null): string {
  return complemento ? `${descricao} ${complemento}` : descricao;
}

/**
 * Onde a regra casa: só no histórico, ou só depois de ler o complemento. O
 * termo já vem normalizado. O exato vale contra o histórico sozinho, como antes
 * de o complemento existir (nenhuma regra antiga deixa de casar), ou contra a
 * linha inteira.
 */
export function ondeCasa(
  r: Pick<RegraExtrato, "termo" | "tipo">,
  alvo: AlvoRegra
): "historico" | "complemento" | null {
  if (!r.termo) return null;
  const bate = (texto: string) => (r.tipo === "exato" ? texto === r.termo : texto.includes(r.termo));
  if (bate(alvo.historico)) return "historico";
  if (alvo.inteiro !== alvo.historico && bate(alvo.inteiro)) return "complemento";
  return null;
}

/**
 * Quão específica é a regra. Exato sempre ganha de parcial; entre parciais,
 * o termo mais longo ganha — assim cadastrar "MAGA" genérico e depois
 * "MAGALHAES COMERCIO" faz o segundo prevalecer sem gerenciar ordem.
 *
 * No meio, o complemento: a regra que só casa lendo o complemento ganha da que
 * casa pelo histórico, mesmo com termo mais curto. O histórico diz o tipo do
 * movimento e se repete no extrato inteiro; "VANIO" no favorecido é mais
 * específico que "DEB.TRANSF.CONTAS DIF.TITULARIDADE", que casa com todo sócio.
 */
export function especificidade(r: RegraExtrato, onde: "historico" | "complemento" = "historico"): number {
  return (r.tipo === "exato" ? 1_000_000 : 0) + (onde === "complemento" ? 10_000 : 0) + r.termo.length;
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
  regras: RegraExtrato[],
  complemento?: string | null
): Casamento | null {
  const alvo = alvoDaLinha(descricao, complemento);
  if (!alvo.inteiro) return null;

  const candidatas: { r: RegraExtrato; forca: number }[] = [];
  for (const r of regras) {
    if (!r.ativo) continue;
    const onde = ondeCasa(r, alvo);
    if (onde) candidatas.push({ r, forca: especificidade(r, onde) });
  }
  if (!candidatas.length) return null;

  let melhor = candidatas[0];
  let empate = false;
  for (const c of candidatas.slice(1)) {
    const d = c.forca - melhor.forca;
    if (d > 0) {
      melhor = c;
      empate = false;
    } else if (d === 0) {
      empate = true;
    }
  }

  const conta = sentido === "pagamento" ? melhor.r.contaPagamento : melhor.r.contaRecebimento;
  return { regra: melhor.r, conta, ambiguo: empate };
}

export interface Transacao {
  data: string;
  /** O histórico: a linha de cima, que diz o tipo do movimento. */
  descricao: string;
  /**
   * O detalhe que o banco imprime embaixo do histórico: favorecido, remetente,
   * a chave do Pix. O histórico se repete no extrato inteiro ("DÉB.TRANSF.CONTAS
   * DIF.TITULARIDADE"); o complemento diz com quem, e é ele que separa a conta
   * de um sócio da do outro. Ausente quando o banco não imprime.
   */
  complemento?: string;
  /** Positivo = entrou na conta; negativo = saiu. */
  valor: number;
}

export interface LancamentoGerado {
  data: string;
  descricao: string;
  complemento?: string;
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
    const m = casar(t.descricao, sentido, regras, t.complemento);
    const contra = m?.conta ?? null;

    return {
      data: t.data,
      descricao: t.descricao,
      ...(t.complemento ? { complemento: t.complemento } : {}),
      valor: Math.abs(t.valor),
      sentido,
      contaDebito: sentido === "recebimento" ? contaBanco : contra,
      contaCredito: sentido === "recebimento" ? contra : contaBanco,
      // Sem histórico na regra, o lançamento leva a linha inteira: no Questor,
      // "DÉB.TRANSF.CONTAS" sozinho não diz para quem foi.
      historico: m?.regra.historico?.trim() || textoDaLinha(t.descricao, t.complemento),
      regraId: m?.regra.id ?? null,
      pendencia: !m ? "sem_regra" : contra == null ? "sem_conta" : null,
      ambiguo: m?.ambiguo ?? false,
    };
  });
}
