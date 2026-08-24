/**
 * APURAÇÃO DE FORMULÁRIO — a definição do formulário vira o painel de resultados.
 *
 * Um formulário já diz o tipo de cada pergunta (marcação, escala, número, texto).
 * Isso é suficiente para saber COMO cada uma se resume: marcação vira contagem
 * por opção, escala vira distribuição + média, número vira média e faixas, texto
 * não se resume — se lista. Nenhum caso no código por pergunta; pergunta nova no
 * construtor já nasce com o seu bloco no painel. Ver [[A definição em dado dirige
 * o comportamento, não um caso no código]] e [[Formulário montado pelo usuário —
 * a definição no banco dirige renderer e validação]].
 *
 * Puro de propósito (sem `server-only`, sem `pg`): o painel apura no cliente com
 * as respostas que já vieram, então trocar o recorte é instantâneo — e dá para
 * testar a conta sem banco.
 */

import {
  escalaDoCampo,
  valorPreenchido,
  type FormularioCampo,
  type RespostaValores,
} from "./formularios-tipos";

/**
 * Mínimo de respostas para exibir um recorte. Pesquisa anônima com filtro vira
 * identificação: "Contábil + menos de 6 meses" pode ser uma pessoa só. Abaixo
 * disso o painel se recusa a mostrar — a promessa de anonimato vale mais que o
 * detalhe.
 */
export const MIN_ANONIMATO = 3;

export interface FatiaApuracao {
  rotulo: string;
  n: number;
  /** Percentual sobre quem RESPONDEU a pergunta (não sobre o total da rodada). */
  pct: number;
}

interface Base {
  campo: FormularioCampo;
  /** Quantos preencheram esta pergunta. */
  respondentes: number;
  /** Quantos deixaram em branco (pergunta opcional). */
  emBranco: number;
}

export interface ApuracaoOpcoes extends Base {
  forma: "opcoes";
  /** Marcação de várias: a soma dos n passa dos respondentes, e o pct também. */
  multipla: boolean;
  fatias: FatiaApuracao[];
}

export interface ApuracaoEscala extends Base {
  forma: "escala";
  fatias: FatiaApuracao[];
  /** Média na escala 1..n (o valor guardado é o índice). */
  media: number | null;
  /** Rótulo do nível mais próximo da média. */
  rotuloMedia: string | null;
  /** Top-2-box: % nos dois níveis mais altos. Só faz sentido de 4 níveis para cima. */
  favoravel: number | null;
  niveis: number;
}

export interface ApuracaoNumero extends Base {
  forma: "numero";
  media: number | null;
  mediana: number | null;
  minimo: number | null;
  maximo: number | null;
  /** Histograma em até 5 faixas dentro do intervalo configurado. */
  fatias: FatiaApuracao[];
}

export interface ApuracaoTexto extends Base {
  forma: "texto";
  /** Os textos, na ordem em que as respostas chegaram. Texto não se resume. */
  textos: string[];
}

export type ApuracaoCampo =
  | ApuracaoOpcoes
  | ApuracaoEscala
  | ApuracaoNumero
  | ApuracaoTexto;

const pct = (n: number, base: number) => (base > 0 ? (n / base) * 100 : 0);

/** Valor de um campo numa resposta, já sabendo se está preenchido. */
function valorDe(campo: FormularioCampo, valores: RespostaValores) {
  const v = valores[String(campo.id)];
  return valorPreenchido(campo.tipo, v) ? v : undefined;
}

function apurarOpcoes(
  campo: FormularioCampo,
  respostas: RespostaValores[],
  multipla: boolean
): ApuracaoOpcoes {
  const opcoes = campo.config.opcoes ?? [];
  const contagem = new Map<string, number>(opcoes.map((o) => [o, 0]));
  let respondentes = 0;

  for (const r of respostas) {
    const v = valorDe(campo, r);
    if (v === undefined) continue;
    respondentes++;
    const marcadas = multipla ? (Array.isArray(v) ? v : []) : [String(v)];
    for (const m of marcadas) {
      // Opção fora da lista atual (a pergunta foi editada depois da resposta):
      // aparece mesmo assim, senão a soma não fecha e some resposta de gente.
      contagem.set(m, (contagem.get(m) ?? 0) + 1);
    }
  }

  return {
    forma: "opcoes",
    campo,
    multipla,
    respondentes,
    emBranco: respostas.length - respondentes,
    fatias: [...contagem.entries()].map(([rotulo, n]) => ({
      rotulo,
      n,
      pct: pct(n, respondentes),
    })),
  };
}

function apurarEscala(campo: FormularioCampo, respostas: RespostaValores[]): ApuracaoEscala {
  const escala = escalaDoCampo(campo);
  const contagem = escala.map(() => 0);
  let soma = 0;
  let respondentes = 0;

  for (const r of respostas) {
    const v = valorDe(campo, r);
    if (typeof v !== "number") continue;
    const i = Math.trunc(v);
    if (i < 0 || i >= escala.length) continue; // escala encolheu depois da resposta
    respondentes++;
    contagem[i]++;
    soma += i + 1; // guardado é índice; a escala que o usuário vê começa em 1
  }

  const media = respondentes > 0 ? soma / respondentes : null;
  const altos = escala.length >= 4 ? contagem.slice(-2).reduce((a, b) => a + b, 0) : null;

  return {
    forma: "escala",
    campo,
    respondentes,
    emBranco: respostas.length - respondentes,
    niveis: escala.length,
    fatias: escala.map((rotulo, i) => ({
      rotulo: rotulo.trim() === String(i + 1) ? rotulo : `${i + 1} · ${rotulo}`,
      n: contagem[i],
      pct: pct(contagem[i], respondentes),
    })),
    media,
    rotuloMedia: media != null ? escala[Math.min(escala.length - 1, Math.round(media) - 1)] : null,
    favoravel: altos != null && respondentes > 0 ? pct(altos, respondentes) : null,
  };
}

/** Quantas faixas o histograma usa quando o intervalo é grande. */
const FAIXAS = 5;

function apurarNumero(campo: FormularioCampo, respostas: RespostaValores[]): ApuracaoNumero {
  const valores: number[] = [];
  for (const r of respostas) {
    const v = valorDe(campo, r);
    if (typeof v === "number" && !Number.isNaN(v)) valores.push(v);
  }
  const respondentes = valores.length;
  const base: Base = { campo, respondentes, emBranco: respostas.length - respondentes };
  if (respondentes === 0) {
    return { ...base, forma: "numero", media: null, mediana: null, minimo: null, maximo: null, fatias: [] };
  }

  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const mediana =
    ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;

  // Faixas dentro do intervalo CONFIGURADO (não do observado): assim o gráfico
  // não muda de eixo a cada recorte, e dá para comparar dois segmentos.
  const min = campo.config.min ?? Math.min(...ordenados);
  const max = campo.config.max ?? Math.max(...ordenados);
  const intervalo = max - min;
  const nFaixas = intervalo <= 0 ? 1 : Math.min(FAIXAS, Math.max(1, Math.round(intervalo)));
  const largura = intervalo / nFaixas || 1;
  const contagem = Array.from({ length: nFaixas }, () => 0);
  for (const v of ordenados) {
    const i = intervalo <= 0 ? 0 : Math.min(nFaixas - 1, Math.floor((v - min) / largura));
    contagem[Math.max(0, i)]++;
  }
  const rotuloFaixa = (i: number) => {
    const de = min + i * largura;
    const ate = i === nFaixas - 1 ? max : de + largura;
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    return `${fmt(de)} a ${fmt(ate)}`;
  };

  return {
    ...base,
    forma: "numero",
    media: valores.reduce((a, b) => a + b, 0) / respondentes,
    mediana,
    minimo: ordenados[0],
    maximo: ordenados[ordenados.length - 1],
    fatias: contagem.map((n, i) => ({ rotulo: rotuloFaixa(i), n, pct: pct(n, respondentes) })),
  };
}

function apurarTexto(campo: FormularioCampo, respostas: RespostaValores[]): ApuracaoTexto {
  const textos: string[] = [];
  for (const r of respostas) {
    const v = valorDe(campo, r);
    if (typeof v === "string" && v.trim()) textos.push(v.trim());
  }
  return {
    forma: "texto",
    campo,
    respondentes: textos.length,
    emBranco: respostas.length - textos.length,
    textos,
  };
}

/** Apura todas as perguntas do formulário sobre o conjunto de respostas dado. */
export function apurarFormulario(
  campos: FormularioCampo[],
  respostas: RespostaValores[]
): ApuracaoCampo[] {
  return campos.map((campo) => {
    switch (campo.tipo) {
      case "selecao_unica":
        return apurarOpcoes(campo, respostas, false);
      case "selecao_multipla":
        return apurarOpcoes(campo, respostas, true);
      case "nota":
        return apurarEscala(campo, respostas);
      case "pontuacao":
        return apurarNumero(campo, respostas);
      default:
        return apurarTexto(campo, respostas);
    }
  });
}

/** Teto de opções para uma pergunta virar filtro (acima disso não é recorte, é lista). */
const MAX_OPCOES_SEGMENTO = 15;

/**
 * Perguntas que servem de RECORTE: marcação de uma opção só, com poucas opções —
 * "em qual setor você trabalha", "há quanto tempo está na empresa". Sai da própria
 * definição; ninguém precisa marcar nada como "campo de segmento".
 */
export function camposDeSegmento(campos: FormularioCampo[]): FormularioCampo[] {
  return campos.filter(
    (c) =>
      c.tipo === "selecao_unica" &&
      (c.config.opcoes?.length ?? 0) > 1 &&
      (c.config.opcoes?.length ?? 0) <= MAX_OPCOES_SEGMENTO
  );
}

export interface Segmento {
  campoId: number;
  valor: string;
}

export function filtrarRespostas(
  respostas: RespostaValores[],
  segmento: Segmento | null
): RespostaValores[] {
  if (!segmento) return respostas;
  return respostas.filter((r) => String(r[String(segmento.campoId)] ?? "") === segmento.valor);
}

export interface IndicadoresGerais {
  /** Média das médias das perguntas de escala, normalizada em 0..100. */
  indice: number | null;
  /** Favorabilidade média (top-2-box) das perguntas de escala com 4+ níveis. */
  favoravel: number | null;
  /** Quantas perguntas de escala entraram na conta. */
  perguntasEscala: number;
}

/**
 * Indicadores do topo. O índice normaliza cada escala para 0..100 antes de somar
 * — sem isso, misturar uma escala de 4 níveis com uma de 5 daria peso diferente
 * para a mesma opinião.
 */
export function indicadoresGerais(apuracoes: ApuracaoCampo[]): IndicadoresGerais {
  const escalas = apuracoes.filter(
    (a): a is ApuracaoEscala => a.forma === "escala" && a.media != null && a.respondentes > 0
  );
  if (escalas.length === 0) return { indice: null, favoravel: null, perguntasEscala: 0 };

  const normalizadas = escalas.map((e) => ((e.media! - 1) / (e.niveis - 1)) * 100);
  const comFavoravel = escalas.filter((e) => e.favoravel != null);

  return {
    indice: normalizadas.reduce((a, b) => a + b, 0) / normalizadas.length,
    favoravel: comFavoravel.length
      ? comFavoravel.reduce((a, e) => a + e.favoravel!, 0) / comFavoravel.length
      : null,
    perguntasEscala: escalas.length,
  };
}
