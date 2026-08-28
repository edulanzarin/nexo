import { montarFaixas } from "./contabil-prod-escala";
import type { ClasseOrigem, CtbDia, CtbItem, PorClasse } from "./contabil-produtividade-tipos";

/**
 * Tipos da aba EXCLUSÕES da Produtividade do Contábil — o que o time APAGOU no
 * período, lido do `lctoctbexcluido`.
 *
 * O recorte é `dataexclusao` (quando apagou), irmão do `datahoralctoctb` da aba
 * Lançamentos: as duas medem trabalho do período, não competência do fato. A
 * exclusão não tem hora, só data — por isso esta aba não tem gráfico de horas.
 *
 * Exclusão não é erro por definição: reimportar um mês inteiro apaga e regrava
 * milhares de linhas, e isso é rotina. O que a tela mostra é o VOLUME de
 * regravação e de quem ela é — quem apaga muito lançamento VELHO e de OUTRA
 * pessoa está mexendo em mês fechado, e isso é outra conversa.
 */

/** Idade do lançamento no dia em que foi excluído. Mesma escada do atraso. */
export const FAIXAS_IDADE = montarFaixas([
  { id: "dia", rotulo: "No mesmo dia", desde: 0 },
  { id: "semana", rotulo: "1 a 7 dias", desde: 1 },
  { id: "mes", rotulo: "8 a 30 dias", desde: 8 },
  { id: "trimestre", rotulo: "31 a 90 dias", desde: 31 },
  { id: "velho", rotulo: "Mais de 90 dias", desde: 91 },
]);

/** Uma pessoa que excluiu lançamento no período. */
export interface CtbExclPessoa {
  codigo: number;
  nome: string;
  inativo: boolean;
  excluidos: number;
  valor: number;
  empresas: number;
  dias: number;
  /** Excluídos que ela mesma havia lançado (o resto é lançamento de outra pessoa). */
  proprios: number;
  /** Mediana da idade (em dias) do que apagou — resistente ao lote gigante. */
  idadeMediana: number | null;
  /** Idade máxima: o lançamento mais velho que ela mexeu. */
  idadeMaxima: number;
  porClasse: PorClasse;
  porFaixa: number[];
  /** Origens do que ela apagou, para a tela isolar sem nova ida ao banco. */
  origens: { chave: string; qtd: number }[];
  /** De quem eram os lançamentos que ela apagou (código do usuário). */
  autores: { chave: string; qtd: number }[];
  topEmpresas: CtbItem[];
  serie: CtbDia[];
}

/** Quem havia LANÇADO o que foi excluído (o outro lado da conta). */
export interface CtbExclAutor extends CtbItem {
  /** Quantos dos excluídos dele foram apagados por ele mesmo. */
  proprios: number;
}

export interface CtbExclSeriePonto {
  bucket: string;
  total: number;
}

export interface ContabilExclusoesResp {
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: {
    excluidos: number;
    valor: number;
    pessoas: number;
    empresas: number;
    dias: number;
    /** Lançados no MESMO período (aba Lançamentos) — denominador do retrabalho. */
    lancados: number;
    idadeMediana: number | null;
    /** Excluídos por quem não os lançou. */
    deOutros: number;
    porClasse: PorClasse;
    porFaixa: number[];
  };
  anterior: { excluidos: number };
  ranking: CtbExclPessoa[];
  autores: CtbExclAutor[];
  origens: { chave: string; nome: string; classe: ClasseOrigem; qtd: number; valor: number }[];
  empresas: CtbItem[];
  serie: CtbExclSeriePonto[];
  calendario: { inicio: string; fim: string; celulas: CtbDia[]; total: number; pico: CtbDia | null };
}
