import { montarFaixas } from "./prod-escala";

/**
 * Tipos e catálogo da aba APURAÇÃO da Produtividade do Fiscal — o FECHAMENTO
 * mensal, que é o trabalho mais pesado do setor e não aparecia em lugar nenhum.
 *
 * As outras abas contam o que entrou (nota escriturada) e o peso disso
 * (imposto destacado). Nenhuma vê o gesto de FECHAR: apurar o imposto de uma
 * empresa numa competência. Fonte: `periodoapuradofis` (o imposto do próprio
 * movimento) e `periodoapuradofisretido` (as retenções), as duas com
 * `codigousuario` + `datahorausuario`.
 *
 * Medido em ago/2026, escritório inteiro: 2.227 linhas, 968 fechamentos, 43
 * pessoas, 591 empresas, 11 tipos de imposto e ZERO linhas de sistema — é
 * trabalho humano de ponta a ponta, diferente do fiscal de nota, onde a
 * integração responde por 98%.
 */

/**
 * LINHA NÃO É APURAÇÃO, e a diferença é grande o bastante para mudar o número
 * da tela. Um fechamento grava uma linha POR IMPOSTO: os tipos 1, 13 e 77 têm
 * contagem idêntica mês a mês (754 cada em ago/2026) porque saem juntos do
 * mesmo gesto. Contar linhas infla o trabalho em 2,3×.
 *
 * Então a seção conta as duas coisas, com nomes diferentes: **fechamento** é
 * (empresa, estabelecimento, competência) — o gesto —, e **apuração** é a linha,
 * um imposto dentro dele. O ranking ordena por fechamento; a quebra por imposto
 * usa as linhas, que é o grão em que ela faz sentido.
 */
export type ChaveApuracao = string;

/**
 * ESCADA DO ATRASO DE APURAÇÃO — dias entre o fim da competência
 * (`datafinal`) e o dia em que se apurou (`datahorausuario`).
 *
 * Não é a escada da aba Atraso (que mede escrituração de nota), e não é a do
 * Contábil — [[Escada ordinal empresta a forma entre domínios, nunca os
 * cortes]]. Aqui o ciclo normal é fechar o mês passado dentro do mês seguinte,
 * então o primeiro degrau vai até 30 dias. Calibrada contra o medido em
 * jul-ago/2026: o trio 1/13/77 fecha com mediana de 15 dias e p90 de 44 (cai
 * nos dois primeiros degraus); o tipo 71 tem mediana de 293 e p90 de 485, e
 * precisa cair no vermelho sem empatar com quem está só um mês atrás.
 *
 * O piso é aberto para baixo porque **apuração antecipada existe**: o mínimo
 * medido é −174 dias (fechar a competência antes de ela terminar). Antecipado é
 * tão "em dia" quanto zero, e não merece degrau próprio.
 */
export const FAIXAS_APURACAO = montarFaixas([
  { id: "ciclo", rotulo: "Até 30 dias", desde: Number.NEGATIVE_INFINITY },
  { id: "mes", rotulo: "31 a 60 dias", desde: 31 },
  { id: "trimestre", rotulo: "61 a 120 dias", desde: 61 },
  { id: "ano", rotulo: "121 a 365 dias", desde: 121 },
  { id: "velho", rotulo: "Mais de um ano", desde: 366 },
]);

/**
 * NOMES DOS IMPOSTOS — e por que quase todos são um número.
 *
 * `tipoimposto` não tem tabela de dimensão no Questor: varri as 58 tabelas que
 * têm essa coluna e nenhuma é um cadastro de rótulo (a tabela `imposto` existe,
 * mas é de OUTRO domínio — o código 77 lá é "Dívida Ativa Ajuizada
 * parcelamento", e aqui 77 sai junto do ICMS todo mês). O `memcalculo`, que
 * poderia nomear, vem vazio nesta base.
 *
 * Então o catálogo carrega SÓ o que foi provado, e o resto aparece pelo código.
 * Inventar rótulo aqui seria [[Rótulo feito de chave técnica aponta para o
 * registro errado quando os dois ids se parecem]] com um imposto no lugar de
 * uma nota — pior, porque o leitor confia.
 *
 * O que foi provado, por impressão digital em `lctofissaicfop` (mesma coluna,
 * mesmo banco), sobre jul/2026:
 *
 * - **1 = ICMS**: alíquotas 12, 17, 7, 4, 18, 25 e 19,5% (o mapa clássico do
 *   ICMS: interestadual 12/7/4, interno 17/18/19,5, seletivo 25) e aparece só em
 *   NFE, NFCE e CTE — mercadoria e transporte, nunca serviço.
 * - **2 = ISS**: alíquotas 2 e 3% e aparece EXCLUSIVAMENTE em NFSE. (Era o
 *   candidato natural a IPI pela ordem numérica, e não é — a alíquota e a
 *   espécie desmentem.)
 *
 * Batem com o alcance na apuração: 364 empresas apuram o tipo 1 e 106 o tipo 2,
 * e o escritório tem muito mais cliente de mercadoria que de serviço.
 *
 * Para nomear os outros, o caminho é o time fiscal olhar a tela (que mostra
 * código, alcance e cadência) e dizer — cada resposta é uma linha aqui.
 */
export const IMPOSTOS_NOMEADOS: Record<number, string> = {
  1: "ICMS",
  2: "ISS",
};

/**
 * Chave estável de um imposto na resposta. Retenção mora em OUTRA tabela, com
 * um domínio de `tipoimposto` que se sobrepõe ao do movimento (lá existem 20,
 * 27, 51 e 53; aqui, 1 a 77) — sem o prefixo, o 20 de uma viraria o 20 da
 * outra e as duas somariam em silêncio.
 */
export const chaveImposto = (tipo: number, retido: boolean): ChaveApuracao =>
  retido ? `R${tipo}` : `M${tipo}`;

/** Rótulo de exibição de um imposto. Sem nome provado, mostra o código. */
export function rotuloImposto(chave: ChaveApuracao): string {
  const retido = chave.startsWith("R");
  const tipo = Number(chave.slice(1));
  if (retido) return `Retenção ${tipo}`;
  return IMPOSTOS_NOMEADOS[tipo] ?? `Imposto ${tipo}`;
}

/** O imposto tem nome de verdade, ou está aparecendo pelo código? */
export const impostoNomeado = (chave: ChaveApuracao): boolean =>
  !chave.startsWith("R") && IMPOSTOS_NOMEADOS[Number(chave.slice(1))] !== undefined;

/** Um imposto apurado no período, com o atraso típico de quem o fechou. */
export interface FisApuImposto {
  chave: ChaveApuracao;
  nome: string;
  /** Linhas de apuração (uma por imposto dentro de cada fechamento). */
  qtd: number;
  empresas: number;
  pessoas: number;
  mediana: number | null;
  p90: number | null;
  porFaixa: number[];
  /** Falso quando o rótulo é só o código — a tela marca isso. */
  nomeado: boolean;
}

/** Uma pessoa do fiscal no fechamento do período. */
export interface FisApuPessoa {
  codigo: number;
  nome: string;
  inativo: boolean;
  /** Gestos de fechamento: (empresa, estab, competência) distintos. */
  fechamentos: number;
  /** Linhas — um imposto apurado dentro de um fechamento. */
  apuracoes: number;
  impostos: number;
  empresas: number;
  competencias: number;
  diasAtivos: number;
  mediana: number | null;
  p90: number | null;
  /** A competência mais antiga que ela fechou no período ("YYYY-MM"). */
  maisVelha: string | null;
  porFaixa: number[];
  porImposto: { chave: ChaveApuracao; qtd: number }[];
  topEmpresas: { chave: string; nome: string; qtd: number; valor: number }[];
  porHora: number[];
  serie: { d: string; n: number }[];
}

export interface FisApuEmpresa {
  chave: string;
  nome: string;
  /** Fechamentos da empresa no período. */
  qtd: number;
  valor: number;
  impostos: number;
  mediana: number | null;
  maisVelha: string | null;
}

/** Um mês de competência fechado durante o período de trabalho. */
export interface FisApuCompetencia {
  compet: string;
  /** Fechamentos daquela competência. */
  qtd: number;
  empresas: number;
  pessoas: number;
  mediana: number | null;
}

/**
 * Um bucket da série: quanto o time fechou naquele dia/mês, e com que atraso.
 * Carrega mediana E p90 porque é a forma que o `CtbAtrasoSerie` consome — o
 * gráfico é o mesmo das outras abas de atraso, e quem se adapta é quem chega.
 */
export interface FisApuPonto {
  bucket: string;
  total: number;
  mediana: number | null;
  p90: number | null;
}

export interface FiscalApuracaoResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: {
    fechamentos: number;
    apuracoes: number;
    pessoas: number;
    empresas: number;
    competencias: number;
    diasAtivos: number;
    mediana: number | null;
    p90: number | null;
    /** Fechamentos no primeiro degrau — dentro do ciclo normal. */
    noCiclo: number;
    maisVelha: string | null;
    porFaixa: number[];
  };
  anterior: { fechamentos: number; apuracoes: number };
  ranking: FisApuPessoa[];
  impostos: FisApuImposto[];
  empresas: FisApuEmpresa[];
  competencias: FisApuCompetencia[];
  serie: FisApuPonto[];
  porHora: number[];
  calendario: {
    inicio: string;
    fim: string;
    celulas: { d: string; n: number }[];
    total: number;
    pico: { d: string; n: number } | null;
  };
  /** Quantos tipos apareceram sem nome — a tela avisa em vez de fingir. */
  semNome: number;
}
