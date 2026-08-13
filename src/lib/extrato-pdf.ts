import type { Transacao } from "./regras-extrato";
import type { ExtratoLido } from "./extrato-ofx";
import { acharConfig, lerTabular, type ResultadoTabular } from "./extrato-tabular";

/**
 * Leitor de extrato em PDF. Cada banco tem um layout próprio, então isto é um
 * conjunto de leitores registrados — o texto é extraído uma vez e o primeiro
 * leitor que reconhecer o formato assume.
 *
 * O texto precisa vir de `pdftotext -layout`, que preserva as colunas; sem o
 * `-layout` as colunas viram uma sopa e não dá para separar valor de descrição.
 */

const MESES: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

/** "1.618,22" → 1618.22 */
function valorBR(texto: string): number | null {
  const limpo = texto.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const RE_VALOR = /^[\d.]+,\d{2}$/;
/** "03 FEV 2025" no começo da linha. */
const RE_DIA = /^(\d{2})\s+([A-Z]{3})\s+(\d{4})\b/;
const RE_GRUPO = /Total de (entradas|sa[ií]das)/i;

export interface LeitorPdf {
  banco: string;
  /** Reconhece o extrato pelo texto extraído. */
  reconhece: (texto: string) => boolean;
  ler: (texto: string) => ExtratoLido;
}

/**
 * Nubank (NU PAGAMENTOS). Layout:
 *
 *   03 FEV 2025    Total de entradas                          + 1.735,02
 *                  Transferência Recebida                        116,80
 *                  Total de saídas                            - 623,11
 *                  Transferência enviada pelo Pix  HAVAN ...     450,00
 *                                                  continuação da descrição
 *
 * Dois detalhes que definem a leitura: a data só aparece no cabeçalho do dia
 * (as transações abaixo herdam), e **o sinal vem do grupo**, não da linha — um
 * mesmo dia pode ter um bloco de entradas e outro de saídas.
 */
export const nubank: LeitorPdf = {
  banco: "Nubank",
  reconhece: (t) => /NU PAGAMENTOS|nubank/i.test(t),

  ler(texto) {
    const transacoes: Transacao[] = [];
    let dia: string | null = null;
    let sinal = -1;
    // Para grudar as linhas de continuação na descrição da transação anterior.
    let ultima: Transacao | null = null;

    for (const linha of texto.split("\n")) {
      if (!linha.trim()) continue;

      const mDia = linha.match(RE_DIA);
      if (mDia) {
        const mes = MESES[mDia[2].toUpperCase()];
        dia = mes ? `${mDia[3]}-${mes}-${mDia[1]}` : dia;
      }

      const mGrupo = linha.match(RE_GRUPO);
      if (mGrupo) {
        sinal = /entrada/i.test(mGrupo[1]) ? 1 : -1;
        ultima = null;
        continue;
      }
      if (!dia) continue;

      // Transações e continuações são indentadas; texto na coluna 1 é rodapé
      // ("Tem alguma dúvida?…", ouvidoria) e não pode grudar na descrição.
      if (!/^\s{6}/.test(linha)) {
        ultima = null;
        continue;
      }

      // Colunas do -layout são separadas por 2+ espaços.
      const campos = linha.trim().split(/\s{2,}/).filter(Boolean);
      const fim = campos[campos.length - 1];

      if (campos.length >= 2 && RE_VALOR.test(fim)) {
        const valor = valorBR(fim);
        if (valor == null) continue;
        // [tipo, descrição, valor] ou [tipo, valor] quando não há descrição.
        const partes = campos.slice(0, -1);
        const descricao = partes.join(" - ").replace(/\s+/g, " ").trim();
        ultima = { data: dia, descricao, valor: sinal * Math.abs(valor) };
        transacoes.push(ultima);
        continue;
      }

      // Linha sem valor logo depois de uma transação: continuação da descrição.
      if (ultima && campos.length === 1) {
        ultima.descricao = `${ultima.descricao} ${campos[0]}`.replace(/\s+/g, " ").trim();
      }
    }

    const conta = texto.match(/Conta\s*\n?\s*([\d-]{6,})/)?.[1] ?? null;
    const agencia = texto.match(/Ag[êe]ncia\s+(\d{3,4})/)?.[1] ?? null;
    const datas = transacoes.map((t) => t.data).sort();

    return {
      transacoes,
      banco: "Nubank",
      agencia,
      conta,
      inicio: datas[0] ?? null,
      fim: datas[datas.length - 1] ?? null,
    };
  },
};

/** Dinheiro BR com posição e sinal: "-2.880,00" → -2880 (débito colado). */
const RE_MOEDA = /(-?)(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
/** Data completa no começo da linha (coluna Data). */
const RE_DATA_MENSAL = /^\s*(\d{2})\/(\d{2})\/(\d{4})\b/;
/** Cabeçalho de página, totais e rótulos que se repetem — nunca são lançamento. */
const RUIDO_MENSAL =
  /Extrato Mensal|Extrato de:|CNPJ:|Nome do usu[áa]rio|Data da opera[çc][ãa]o|^\s*Folha\s+\d|Ag[êe]ncia\s*\|\s*Conta|Total Dispon[íi]vel|Investimento sem|^\s*Data\s+Lan[çc]amento|Os dados acima|[ÚU]ltimos Lan[çc]amentos|^\s*Total\b/i;
/** Prefixos de tipo de lançamento do Bradesco — o que abre um lançamento novo. */
const RE_TIPO_MENSAL =
  /^(RENTAB|PAGTO|PGTO|PIX|TED |DOC\/TED|LIQUIDA|TARIFA|TAR |TRANSF|GASTOS|CONTA DE|APLICA|RESGATE|ESTORNO|DEP[OÓ]SITO|SAQUE|DEBITO|TRIBUTO|SDO)/i;

interface MoedaPos {
  valor: number;
  /** Onde o número começa — para separar a descrição (à esquerda) do valor. */
  pos: number;
}

function moedasComPos(linha: string): MoedaPos[] {
  const out: MoedaPos[] = [];
  RE_MOEDA.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_MOEDA.exec(linha))) {
    const n = Number(m[2].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) out.push({ valor: m[1] === "-" ? -n : n, pos: m.index });
  }
  return out;
}

/** Uma linha classificada do corpo do extrato "Extrato Mensal". */
interface LinhaMensal {
  /** Índice da linha física, para medir distância entre linhas. */
  i: number;
  tipo: "valor" | "texto" | "saldoAnterior";
  data: string | null;
  /** valor/saldoAnterior: saldo corrente da linha. */
  saldo: number | null;
  /** valor: coluna Crédito/Débito, só para conferir contra a diferença de saldo. */
  colValor: number | null;
  /** texto: a descrição; valor: a descrição que veio colada na própria linha. */
  texto: string;
}

interface LancamentoBruto {
  data: string;
  partes: string[];
  valor: number;
}

/**
 * Bradesco "Extrato Mensal / Por Período" (Net Empresa). Layout que quebra o
 * motor tabular por dois motivos: a data só aparece na PRIMEIRA linha do dia (as
 * demais herdam) e cada lançamento ocupa 2–3 linhas físicas — o tipo em cima, a
 * do meio com Dcto + valor + saldo, e a contraparte embaixo:
 *
 *   01/06/2026  RENTAB.INVEST FACILCRED*   6618000     0,25              228.749,91
 *               PAGTO ELETRON COBRANCA
 *                                          20186              -2.880,00   225.869,91
 *               FORTEXTIL TECIDOS E AVIAMENTOS L
 *
 * Por isso não dá para ancorar na data como o tabular. A âncora é a LINHA DE
 * VALOR (a que traz o saldo corrente): o valor sai da diferença de saldo — que
 * dá o sinal de graça e ainda confere contra a coluna Crédito/Débito — e a
 * descrição é montada juntando o tipo (linha de cima) com a contraparte (as de
 * baixo). Um lançamento começa numa linha de tipo, e uma linha de tipo só abre
 * lançamento novo quando a linha de valor seguinte não traz o tipo colada nela;
 * assim rótulos como "TRANSF PGTO PIX" ficam como detalhe da tarifa acima em vez
 * de virar um lançamento fantasma.
 */
export const bradescoMensal: LeitorPdf = {
  banco: "Bradesco",
  // Casa o LAYOUT, não a marca: "BRADESCO SEGUROS" aparece como contraparte em
  // qualquer banco (e casaria o Bradesco tabular por engano). O título da folha
  // do Net Empresa é o marcador seguro.
  reconhece: (t) => /Extrato Mensal\s*\/\s*Por Per[íi]odo/i.test(t),

  ler(texto) {
    const linhas = texto.split("\n");
    // Os lançamentos vivem entre o primeiro "SALDO ANTERIOR" e a seção "Saldos
    // Invest Fácil" (saldos diários da aplicação, que não são movimento).
    let ini = linhas.findIndex((l) => /SALDO ANTERIOR/i.test(l));
    if (ini < 0) ini = 0;
    let fim = linhas.findIndex((l) => /Saldos?\s+Invest\s+F[áa]cil/i.test(l));
    if (fim < 0) fim = linhas.length;
    const corpo = linhas.slice(ini, fim);

    // Passo 1: classificar cada linha em valor / texto / saldo anterior.
    const recs: LinhaMensal[] = [];
    for (let i = 0; i < corpo.length; i++) {
      const linha = corpo[i];
      if (!linha.trim() || RUIDO_MENSAL.test(linha)) continue;

      const mData = linha.match(RE_DATA_MENSAL);
      const data = mData ? `${mData[3]}-${mData[2]}-${mData[1]}` : null;
      const aposData = mData ? mData[0].length : 0;
      const ms = moedasComPos(linha);

      if (/SALDO ANTERIOR/i.test(linha)) {
        recs.push({ i, tipo: "saldoAnterior", data, saldo: ms.length ? ms[ms.length - 1].valor : null, colValor: null, texto: "" });
      } else if (ms.length >= 2) {
        // Linha do meio: [descrição colada?, Dcto, valor, saldo]. A descrição
        // colada é o que vem antes do primeiro número, menos o Dcto (inteiro).
        const colado = linha.slice(aposData, ms[0].pos).replace(/\s{2,}\d+\s*$/, "");
        recs.push({
          i,
          tipo: "valor",
          data,
          saldo: ms[ms.length - 1].valor,
          colValor: Math.abs(ms[ms.length - 2].valor),
          texto: colado.replace(/\s+/g, " ").trim(),
        });
      } else {
        recs.push({ i, tipo: "texto", data, saldo: null, colValor: null, texto: linha.slice(aposData).replace(/\s+/g, " ").trim() });
      }
    }

    // Passo 2: montar os lançamentos. O saldo corrente dá o valor e o sinal; a
    // descrição junta o tipo pendente, o texto colado na linha de valor e os
    // detalhes que vêm depois.
    const brutos: LancamentoBruto[] = [];
    let saldo: number | null = null;
    let dia: string | null = null;
    let confere = true;
    let checou = false;
    let pendente: string[] = []; // linhas de tipo à espera da linha de valor
    let esperandoValor = false;
    let ultima: LancamentoBruto | null = null; // para grudar detalhes seguintes

    for (let k = 0; k < recs.length; k++) {
      const r = recs[k];
      if (r.data) dia = r.data;

      if (r.tipo === "saldoAnterior") {
        if (r.saldo != null) saldo = r.saldo;
        pendente = [];
        esperandoValor = false;
        ultima = null;
        continue;
      }

      if (r.tipo === "texto") {
        if (!r.texto) continue;
        const prox = recs[k + 1];
        const proxPrecisaTipo = !!prox && prox.tipo === "valor" && !RE_TIPO_MENSAL.test(prox.texto);
        if (RE_TIPO_MENSAL.test(r.texto) && proxPrecisaTipo) {
          pendente.push(r.texto);
          esperandoValor = true;
        } else if (esperandoValor) {
          pendente.push(r.texto);
        } else if (ultima) {
          ultima.partes.push(r.texto);
        } else {
          pendente.push(r.texto);
        }
        continue;
      }

      // Linha de valor.
      if (saldo == null) {
        // Sem saldo de partida ainda: adota este como âncora e segue.
        saldo = r.saldo;
        pendente = [];
        esperandoValor = false;
        continue;
      }
      const valor = Number(((r.saldo as number) - saldo).toFixed(2));
      saldo = r.saldo;
      const partes = [...pendente];
      if (r.texto) partes.push(r.texto);
      pendente = [];
      esperandoValor = false;
      if (valor === 0) {
        ultima = null;
        continue;
      }
      if (r.colValor != null) {
        checou = true;
        if (Math.abs(Math.abs(valor) - r.colValor) > 0.02) confere = false;
      }
      ultima = { data: dia ?? "", partes, valor };
      brutos.push(ultima);
    }

    const transacoes: Transacao[] = brutos.map((b) => ({
      data: b.data,
      descricao: b.partes.join(" ").replace(/\s+/g, " ").trim() || "(sem descrição)",
      valor: b.valor,
    }));

    const datas = transacoes.map((t) => t.data).filter(Boolean).sort();
    const resultado: PdfLido = {
      transacoes,
      banco: "Bradesco",
      agencia: texto.match(/Ag:\s*(\d{3,5})/i)?.[1] ?? null,
      conta: texto.match(/CC:\s*([\d.\-]{4,})/i)?.[1] ?? null,
      inicio: datas[0] ?? null,
      fim: datas[datas.length - 1] ?? null,
      // Sem linha conferida (extrato vazio) não há o que atestar.
      saldoConfere: checou ? confere : null,
    };
    return resultado;
  },
};

/** Leitores de layout próprio, que não cabem no motor tabular. */
export const LEITORES: LeitorPdf[] = [nubank, bradescoMensal];

export class PdfNaoReconhecido extends Error {}

export interface PdfLido extends ExtratoLido {
  /** Cadeia de saldos fechou — só quando o extrato traz saldo corrente. */
  saldoConfere?: boolean | null;
}

/**
 * Escolhe o leitor: primeiro os de layout próprio, depois o motor tabular, que
 * cobre a maioria dos bancos por configuração em vez de código.
 */
export function lerPdf(texto: string): PdfLido {
  const proprio = LEITORES.find((l) => l.reconhece(texto));
  if (proprio) return proprio.ler(texto);

  const cfg = acharConfig(texto);
  if (cfg) {
    const r: ResultadoTabular = lerTabular(texto, cfg);
    return r;
  }

  throw new PdfNaoReconhecido(
    "Não reconheci o banco deste PDF. Se o extrato tiver OFX, use o OFX — é padrão e funciona com qualquer banco."
  );
}

/** O PDF está protegido por senha? A tela usa isto para pedir a senha. */
export function exigeSenha(texto: string): boolean {
  return acharConfig(texto)?.exigeSenha ?? false;
}
