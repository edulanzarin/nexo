import type { Transacao } from "./regras-extrato";
import type { ExtratoLido } from "./extrato-ofx";
import type { ModoTextoPdf } from "./pdf-texto";

/**
 * Motor de leitura para extratos em PDF no formato tabular — que é o de quase
 * todos os bancos: uma linha por lançamento, começando com a data.
 *
 * Em vez de um parser por banco, o que muda entre eles é declarado em
 * `ConfigTabular`. O que mais varia é como o sinal é indicado, e aí há um
 * atalho que evita depender disso: quando o extrato traz **saldo corrente** na
 * linha, `valor = saldo − saldoAnterior` dá o sinal de graça e ainda serve de
 * conferência, porque a cadeia de saldos tem que fechar do começo ao fim.
 */

/**
 * Dinheiro em formato BR, aceitando "R$", menos solto e sufixo C/D. O "R" só
 * vale colado no "$": solto, ele casava a última letra da descrição ("VENDOR
 * 9.609,60" virava "VENDO"), e a regra cadastrada pela descrição não casava.
 */
const RE_DINHEIRO = /(-\s*)?(?:R?\$)?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])?/g;
const RE_DATA = /^\s*(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/;

export type ModoSinal =
  /** Deriva do saldo corrente: robusto, e valida a leitura inteira. */
  | "saldo"
  /** Menos explícito no valor ("-1.234,56", "- 1.234,56", "-R$ 9,00"). */
  | "sinal"
  /** Sufixo C/D depois do valor ("1.234,56 D", "0,00C"). */
  | "sufixoCD";

export interface ConfigTabular {
  banco: string;
  /**
   * Identifica o extrato pelo texto extraído. Prefira marcador de LAYOUT a
   * nome de banco: o nome aparece como contraparte nas transações (um extrato
   * Sicredi cita "BELLUNO" e vice-versa), então casar por marca erra o leitor.
   */
  reconhece: (texto: string) => boolean;
  /** Linhas que casam com a data mas não são lançamento (saldos, totais). */
  ignorar: RegExp;
  sinal: ModoSinal;
  /** PDF protegido: a tela pede a senha ao usuário. */
  exigeSenha?: boolean;
  /**
   * Como ler o texto (padrão `layout`). `raw` quando o PDF desenha valor e
   * saldo como colunas à parte e o `layout` os desencontra da descrição; na
   * ordem de desenho a linha do lançamento sai inteira. O reconhecimento roda
   * sempre sobre o `layout`.
   */
  modo?: ModoTextoPdf;
  /**
   * O banco imprime o detalhe do lançamento (favorecido, remetente, a chave do
   * Pix) nas linhas logo abaixo, sem data e sem valor. Ligado, essas linhas
   * viram o `complemento` da transação em vez de serem descartadas.
   */
  complemento?: boolean;
}

interface Achado {
  valor: number;
  /** Índice do caractere onde o número começa — usado para achar o saldo. */
  pos: number;
  sufixo: "C" | "D" | null;
  negativo: boolean;
}

function dinheiros(linha: string): Achado[] {
  const achados: Achado[] = [];
  RE_DINHEIRO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_DINHEIRO.exec(linha))) {
    const cru = m[2];
    const n = Number(cru.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n)) continue;
    achados.push({
      valor: Math.abs(n),
      pos: m.index,
      sufixo: (m[3] as "C" | "D") ?? null,
      // O menos pode vir colado, separado por espaço, ou antes do "R$".
      negativo: !!m[1] || cru.startsWith("-"),
    });
  }
  return achados;
}

/** Saldo de partida, para o modo "saldo" ter de onde começar a cadeia. */
function saldoInicial(texto: string): number | null {
  const m = texto.match(
    /SALDO[^\n]*?(?:ANTERIOR|INICIAL|EM \d{2}\/\d{2}\/\d{4})[^\n]*?(-?\s*R?\$?\s*-?\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])?/i
  );
  if (!m) return null;
  const n = Number(m[1].replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return m[2] === "D" ? -Math.abs(n) : n;
}

const recuo = (linha: string) => linha.length - linha.trimStart().length;

/** A transação recém-lida, à espera do complemento que vem embaixo dela. */
interface Aberta {
  t: Transacao;
  recuo: number;
}

/**
 * O complemento é o bloco colado embaixo da linha do lançamento e mais recuado
 * que ela. Acaba na primeira linha em branco, com valor ou encostada na margem:
 * rodapé, cabeçalho de página e o resumo do fim nunca grudam na descrição.
 */
function complementar(aberta: Aberta, linha: string): Aberta | null {
  const texto = linha.replace(/\s+/g, " ").trim();
  if (!texto || recuo(linha) <= aberta.recuo || dinheiros(linha).length) return null;
  aberta.t.complemento = aberta.t.complemento ? `${aberta.t.complemento} ${texto}` : texto;
  return aberta;
}

export interface ResultadoTabular extends ExtratoLido {
  /** Cadeia de saldos fechou do início ao fim (só no modo "saldo"). */
  saldoConfere: boolean | null;
  /** Quantas linhas com data foram descartadas por não ter valor. */
  ignoradas: number;
}

export function lerTabular(texto: string, cfg: ConfigTabular): ResultadoTabular {
  const transacoes: Transacao[] = [];
  let saldo = cfg.sinal === "saldo" ? saldoInicial(texto) : null;
  const saldoPartida = saldo;
  let ignoradas = 0;
  let anoPadrao: string | null = null;

  // Data sem ano (Daycoval) precisa do ano do período.
  const periodo = texto.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(?:à|a|-|até)\s*\d{2}\/\d{2}\/(\d{4})/i);
  if (periodo) anoPadrao = periodo[3];
  let aberta: Aberta | null = null;

  for (const linha of texto.split("\n")) {
    // Antes da data: complemento pode começar com uma ("02/01 10:15 FULANO"),
    // e o que o separa de um lançamento novo é estar mais recuado e sem valor.
    if (aberta && cfg.complemento) {
      aberta = complementar(aberta, linha);
      if (aberta) continue;
    }
    aberta = null;
    const mData = RE_DATA.exec(linha);
    if (!mData) continue;
    if (cfg.ignorar.test(linha)) continue;

    const ano = mData[3]
      ? mData[3].length === 2
        ? `20${mData[3]}`
        : mData[3]
      : anoPadrao;
    if (!ano) continue;
    const data = `${ano}-${mData[2]}-${mData[1]}`;

    const nums = dinheiros(linha);
    if (!nums.length) {
      ignoradas += 1;
      continue;
    }

    let valor: number | null = null;
    if (cfg.sinal === "saldo") {
      // Último número é o saldo depois do lançamento; o valor é a diferença.
      const novoSaldo = nums[nums.length - 1];
      const assinado = novoSaldo.negativo ? -novoSaldo.valor : novoSaldo.valor;
      if (saldo != null) valor = Number((assinado - saldo).toFixed(2));
      saldo = assinado;
      if (valor == null || valor === 0) {
        if (valor === 0) ignoradas += 1;
        continue;
      }
    } else if (cfg.sinal === "sufixoCD") {
      const alvo = nums.find((n) => n.sufixo) ?? nums[nums.length - 1];
      valor = alvo.sufixo === "D" ? -alvo.valor : alvo.valor;
    } else {
      // Sem saldo corrente: o primeiro número da linha é o valor.
      const alvo = nums[0];
      valor = alvo.negativo ? -alvo.valor : alvo.valor;
    }

    if (valor == null || valor === 0) {
      ignoradas += 1;
      continue;
    }

    const descricao = linha
      .slice(mData[0].length, nums[0].pos)
      .replace(/\s{2,}/g, " ")
      .replace(/\s*-\s*$/, "")
      .trim();

    const t: Transacao = { data, descricao: descricao || "(sem descrição)", valor };
    transacoes.push(t);
    aberta = { t, recuo: recuo(linha) };
  }

  // A cadeia fecha? Soma dos lançamentos + saldo inicial = saldo final lido.
  let saldoConfere: boolean | null = null;
  if (cfg.sinal === "saldo" && saldoPartida != null && saldo != null) {
    const somado = transacoes.reduce((a, t) => a + t.valor, saldoPartida);
    saldoConfere = Math.abs(somado - saldo) < 0.02;
  }

  const datas = transacoes.map((t) => t.data).sort();
  return {
    transacoes,
    banco: cfg.banco,
    agencia: texto.match(/Ag[êe]ncia:?\s*(\d{3,5})/i)?.[1] ?? null,
    conta: texto.match(/Conta(?:\s*Corrente)?:?\s*([\d.\-]{4,})/i)?.[1] ?? null,
    inicio: datas[0] ?? null,
    fim: datas[datas.length - 1] ?? null,
    saldoConfere,
    ignoradas,
  };
}

/** Linhas de saldo/total que aparecem em quase todo extrato. */
const SALDOS = /SALDO|TOTAL D|EXTRATOS EMITIDOS|SDO\s|Saldo (no|do)/i;

/**
 * Ordem importa: o primeiro que reconhecer assume, então os marcadores mais
 * específicos vêm antes dos genéricos.
 */
export const CONFIGS: ConfigTabular[] = [
  {
    // Layout próprio: saldo por dia, não saldo corrente na linha.
    banco: "Belluno",
    reconhece: (t) => /Saldo no (in[ií]cio|fim) do dia/i.test(t),
    ignorar: SALDOS,
    sinal: "sinal",
  },
  {
    banco: "C6",
    reconhece: (t) => /REL\. DE EXTRATO PERI[ÓO]DICO|BANCO C6 S\.A/i.test(t),
    ignorar: SALDOS,
    sinal: "sufixoCD",
    exigeSenha: true,
  },
  {
    // O histórico é abreviado e se repete ("DÉB.TRANSF.CONTAS
    // DIF.TITULARIDADE"); quem recebeu vem na linha de baixo ("FAV.: …",
    // "REM.: …", "Recebimento Pix …").
    banco: "Sicoob",
    reconhece: (t) => /SISBR|SISTEMA DE COOPERATIVAS DE CR[ÉE]DITO/i.test(t),
    ignorar: SALDOS,
    sinal: "sufixoCD",
    complemento: true,
  },
  {
    banco: "Daycoval",
    reconhece: (t) => /dayconnect|daycoval/i.test(t),
    ignorar: SALDOS,
    sinal: "sinal",
  },
  {
    // Cooperativas do sistema Ailos (banco 85: Acredicoop e as irmãs), extrato
    // "Extrato conta corrente". O valor vem sem sinal e o saldo com sinal, e o
    // `layout` joga valor e saldo para as linhas de baixo — em `raw` cada
    // lançamento é uma linha "data descrição valor saldo".
    banco: "Ailos",
    reconhece: (t) =>
      /Cooperativa:.*Banco:\s*85\b/i.test(t) && /Saldo inicial do per[íi]odo/i.test(t),
    ignorar: SALDOS,
    sinal: "saldo",
    modo: "raw",
  },
  {
    // "Associado"/"Cooperativa" é do cabeçalho do Sicredi. Precisa vir antes
    // do Sifra: o extrato do Sicredi cita SIFRA já nas primeiras linhas.
    banco: "Sicredi",
    reconhece: (t) => /Associado/i.test(t) && /Cooperativa/i.test(t),
    ignorar: SALDOS,
    sinal: "saldo",
  },
  {
    banco: "Viacredi",
    reconhece: (t) => /viacredi|cecred|ailos/i.test(t),
    ignorar: SALDOS,
    sinal: "saldo",
  },
  {
    banco: "Sifra",
    reconhece: (t) => /sifra|Extrato Detalhado/i.test(t),
    ignorar: SALDOS,
    sinal: "saldo",
  },
  {
    banco: "Itaú",
    reconhece: (t) => /ita[uú]/i.test(t),
    ignorar: SALDOS,
    sinal: "sinal",
  },
  {
    banco: "Bradesco",
    reconhece: (t) => /bradesco/i.test(t),
    ignorar: SALDOS,
    sinal: "sinal",
  },
];

export function acharConfig(texto: string): ConfigTabular | undefined {
  return CONFIGS.find((c) => c.reconhece(texto));
}
