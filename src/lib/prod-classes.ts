/**
 * VOCABULÁRIO DE CLASSE das seções de Produtividade.
 *
 * Os dois módulos quebram o período por uma dimensão categórica de poucos
 * valores — no Contábil é a NATUREZA do lançamento (digitado, importado,
 * integrado…), no Fiscal é a ESPÉCIE da nota (NFE, NFCE, CTE, NFSE…) —, e as
 * duas desenham o mesmo gráfico empilhado com a mesma faixa de composição.
 *
 * O que é comum é a FORMA (id, rótulo, cor, contagem por id); o catálogo em si
 * é de cada módulo, porque a descrição só faz sentido perto do fato que ela
 * descreve. Por isso aqui mora o tipo, e não a lista.
 */

/** Um degrau da dimensão categórica: o que aparece na legenda e no empilhado. */
export interface ClasseInfo {
  id: string;
  rotulo: string;
  descricao: string;
  cor: string;
}

/** Contagem por classe. Chave livre: quem manda é o catálogo do módulo. */
export type PorClasseGen = Record<string, number>;

/**
 * Um ponto de série já quebrado por classe. O índice é `string | number` porque
 * o ponto carrega o bucket (texto) junto com as contagens — é o preço de o
 * gráfico ler as séries por nome de classe, que é o que o torna compartilhável.
 */
export type SeriePontoGen = {
  bucket: string;
  total: number;
  [classe: string]: string | number;
};

/** Zera um acumulador com exatamente os ids do catálogo. */
export const zeroDe = (classes: ClasseInfo[]): PorClasseGen =>
  Object.fromEntries(classes.map((c) => [c.id, 0]));
