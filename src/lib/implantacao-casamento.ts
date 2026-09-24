import type {
  ContaAlvo,
  LinhaCasada,
  LinhaOrigem,
  OrigemCasamento,
} from "./implantacao-tipos";

/**
 * De-para determinístico (sem IA) entre a conta da contabilidade de origem e a
 * conta reduzida do plano da empresa no Questor. Cascata, do mais confiável ao
 * menos:
 *   1. OVERRIDE salvo — humano já confirmou este casamento antes.
 *   2. CLASSIFICAÇÃO — mesma classificação hierárquica, alvo único e analítico.
 *   3. DESCRIÇÃO — maior similaridade de tokens, restrita à mesma classe (grau-1)
 *      e natureza; acima do limiar alto = casada, na faixa cinza = duvidosa.
 * Sem candidato → sem_conta (o humano resolve na tela, e vira override).
 *
 * Puro (sem banco): quem carrega plano e overrides é `implantacao-depara.ts`.
 * Serve ao balancete e às contas do relatório de bens do patrimonial.
 */

/** Limiar de similaridade de descrição para casar automaticamente. */
const LIMIAR_CASA = 0.72;
/** Abaixo disto nem sugere (evita casar coisa aleatória). */
const LIMIAR_MIN = 0.4;

const STOPWORDS = new Set(["de", "do", "da", "dos", "das", "e", "a", "o", "com", "s", "por"]);

/** Normaliza descrição: sem acento, sem "(-)", maiúsculas, tokens úteis. */
function tokens(s: string): Set<string> {
  const limpo = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\(-\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  return new Set(
    limpo.split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t.toLowerCase()))
  );
}

/** Similaridade de Dice entre dois conjuntos de tokens (0–1). */
function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/**
 * Primeiro segmento da classificação ("1.1.02" → "1", "112" → "1"). Sem zero à
 * esquerda: o SCI classifica "01.2.3.01.005", o Questor "1.2.05.003.015", e os
 * dois são Ativo.
 */
function grau1(classif?: string): string | null {
  if (!classif) return null;
  const seg = classif.includes(".") ? classif.split(".")[0] : classif.slice(0, 1);
  return /^\d+$/.test(seg) ? String(Number(seg)) : seg;
}

/** Conjuntos de tokens dos alvos, pré-computados uma vez. */
interface AlvoIndexado extends ContaAlvo {
  tok: Set<string>;
  g1: string | null;
}

export function casarBalancete(
  origem: LinhaOrigem[],
  alvos: ContaAlvo[],
  overrides: Map<string, number>
): LinhaCasada[] {
  // Só analíticas são alvo válido (sintética não recebe lançamento).
  const idx: AlvoIndexado[] = alvos
    .filter((a) => !a.sintetica)
    .map((a) => ({ ...a, tok: tokens(a.descricao), g1: grau1(a.classif) }));

  const porClassif = new Map<string, AlvoIndexado[]>();
  for (const a of idx) {
    const arr = porClassif.get(a.classif) ?? [];
    arr.push(a);
    porClassif.set(a.classif, arr);
  }
  const porConta = new Map<number, AlvoIndexado>(idx.map((a) => [a.conta, a]));

  const resolver = (linha: LinhaOrigem): {
    conta: number | null;
    via: OrigemCasamento | null;
    confianca: number;
    alvo: AlvoIndexado | null;
  } => {
    // 1. Override salvo.
    const ov = overrides.get(linha.chave);
    if (ov != null) {
      const alvo = porConta.get(ov) ?? null;
      return { conta: ov, via: "override", confianca: 1, alvo };
    }

    // 2. Classificação exata e única.
    if (linha.classif) {
      const cand = porClassif.get(linha.classif);
      if (cand && cand.length === 1) {
        return { conta: cand[0].conta, via: "classif", confianca: 0.9, alvo: cand[0] };
      }
    }

    // 3. Descrição, restrita à mesma classe e natureza quando conhecidas.
    const g = grau1(linha.classif);
    let cand = idx;
    if (g) cand = cand.filter((a) => a.g1 === g);
    if (linha.natureza) {
      const porNat = cand.filter((a) => a.natureza === linha.natureza);
      if (porNat.length) cand = porNat;
    }
    const tok = tokens(linha.descricao);
    let melhor: AlvoIndexado | null = null;
    let melhorSim = 0;
    for (const a of cand) {
      const sim = dice(tok, a.tok);
      if (sim > melhorSim) {
        melhorSim = sim;
        melhor = a;
      }
    }
    if (melhor && melhorSim >= LIMIAR_MIN) {
      return { conta: melhor.conta, via: "descricao", confianca: melhorSim, alvo: melhor };
    }
    return { conta: null, via: null, confianca: 0, alvo: null };
  };

  return origem.map((linha) => {
    const { conta, via, confianca, alvo } = resolver(linha);
    const status =
      conta == null
        ? "sem_conta"
        : via === "descricao" && confianca < LIMIAR_CASA
          ? "duvidosa"
          : "casada";
    // Natureza final: da origem quando marcada, senão da conta de destino.
    const natureza = linha.natureza ?? alvo?.natureza ?? null;
    return {
      origem: linha,
      conta,
      status,
      via,
      confianca,
      contaDescr: alvo?.descricao,
      natureza,
    };
  });
}
