import type { Transacao } from "./regras-extrato";

/**
 * Leitor de OFX 1.x (SGML) e 2.x (XML).
 *
 * O OFX 1.x brasileiro é SGML: as tags de folha às vezes vêm fechadas
 * (`<TRNAMT>-14.47</TRNAMT>`, como o Nubank faz) e às vezes não
 * (`<TRNAMT>-14.47` até a próxima tag). A extração abaixo aceita os dois, em
 * vez de assumir XML bem formado e quebrar com metade dos bancos.
 */

export interface ExtratoLido {
  transacoes: Transacao[];
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  inicio: string | null;
  fim: string | null;
}

/** Valor de uma tag de folha, com ou sem fechamento. */
function tag(bloco: string, nome: string): string | null {
  const re = new RegExp(`<${nome}>\\s*([^<\\r\\n]*)`, "i");
  const m = bloco.match(re);
  const v = m?.[1]?.trim();
  return v ? v : null;
}

/** OFX data: YYYYMMDD[HHMMSS][fuso] → YYYY-MM-DD. */
function data(bruto: string | null): string | null {
  if (!bruto) return null;
  const m = bruto.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Tipos que a especificação do OFX define como saída de dinheiro da conta. */
const TIPOS_SAIDA = new Set([
  "DEBIT", "FEE", "SRVCHG", "PAYMENT", "CHECK", "ATM", "POS", "CASH", "DIRECTDEBIT", "REPEATPMT",
]);

/**
 * Linha de saldo que o banco manda como se fosse transação. Não é movimento:
 * lançada, vira uma entrada do tamanho do saldo inteiro.
 */
const RE_SALDO = /^\s*S(?:AL)?DO\.?\s+(ANTERIOR|INICIAL|FINAL|DO DIA|DISPON)/i;

/** Menor ou maior data entre todas as ocorrências de uma tag. */
function extremo(texto: string, nome: string, qual: "min" | "max"): string | null {
  const datas = [...texto.matchAll(new RegExp(`<${nome}>\\s*(\\d{8})`, "gi"))]
    .map((m) => data(m[1]))
    .filter((d): d is string => !!d)
    .sort();
  return (qual === "min" ? datas[0] : datas[datas.length - 1]) ?? null;
}

export function lerOfx(conteudo: string): ExtratoLido {
  const texto = conteudo.replace(/\r\n?/g, "\n");

  const lidas: (Transacao & { tipo: string | null })[] = [];
  // Cada <STMTTRN> é uma transação; o fechamento pode faltar no SGML, então o
  // bloco termina no próximo STMTTRN ou no fim da lista.
  const blocos = texto.split(/<STMTTRN>/i).slice(1);

  for (const bruto of blocos) {
    const bloco = bruto.split(/<\/BANKTRANLIST>|<\/STMTTRN>/i)[0];
    const dt = data(tag(bloco, "DTPOSTED"));
    const valorTexto = tag(bloco, "TRNAMT");
    if (!dt || !valorTexto) continue;

    // Alguns bancos usam vírgula decimal mesmo em OFX.
    const valor = Number(valorTexto.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    if (!Number.isFinite(valor)) continue;

    const memo = (tag(bloco, "MEMO") ?? tag(bloco, "NAME") ?? "").replace(/\s+/g, " ").trim();
    if (RE_SALDO.test(memo)) continue;
    lidas.push({ data: dt, descricao: memo, valor, tipo: tag(bloco, "TRNTYPE")?.toUpperCase() ?? null });
  }

  // Pela especificação o sinal vem no TRNAMT, e o TRNTYPE só classifica. Mas há
  // banco (o Ailos, das cooperativas do banco 85) que manda todo valor POSITIVO
  // e diz a direção só no TRNTYPE — lido pelo valor, a saída vira entrada. A
  // decisão é por ARQUIVO: se algum valor é negativo, o banco usa sinal e o
  // TRNTYPE não mexe em nada; sem nenhum negativo, a saída vem do tipo.
  const usaSinal = lidas.some((t) => t.valor < 0);
  const transacoes: Transacao[] = lidas.map(({ tipo, ...t }) => ({
    ...t,
    valor: !usaSinal && tipo && TIPOS_SAIDA.has(tipo) ? -Math.abs(t.valor) : t.valor,
  }));

  return {
    transacoes,
    banco: tag(texto, "ORG") ?? tag(texto, "BANKID"),
    agencia: tag(texto, "BRANCHID"),
    conta: tag(texto, "ACCTID"),
    // Há banco que abre uma BANKTRANLIST por dia: o período vai da primeira
    // abertura ao último fechamento, não da primeira lista.
    inicio: extremo(texto, "DTSTART", "min"),
    fim: extremo(texto, "DTEND", "max"),
  };
}
