import type { LinhaPlano, PlanoCfop } from "./types";

/**
 * Parte PURA do aprendizado da conta efetiva: o vocabulário e a aplicação do
 * que foi aprendido sobre o plano. A leitura do Questor e a escrita no app-db
 * moram em conta-efetiva.ts (server-only) — aqui não entra banco, para o
 * cálculo poder ser testado.
 *
 * O porquê do aprendizado está lá; o resumo é: em natureza de SERVIÇO a tabela
 * de contabilização do Questor envelhece (a empresa cria conta nova e a
 * natureza segue apontando pra velha), então quem manda é o histórico.
 */

/** Natureza de serviço no Questor: os códigos internos 8xxxxxx (não é CFOP fiscal). */
export const CFOP_SERVICO_MIN = 8_000_000;

export interface ContaEfetiva {
  contaPlano: number | null;
  /** A conta habitual; null em natureza genérica, onde nenhuma domina. */
  contaEfetiva: number | null;
  descrEfetiva: string | null;
  /** A moda domina o histórico? Só então existe regra de conta para cobrar. */
  habitual: boolean;
  notas: number;
  acertos: number;
}

/** A conta que o plano do Questor manda no componente principal da natureza. */
export function contaDoPlano(p: PlanoCfop): number | null {
  const principal = p.componentes.find((c) => c.id === "vlrcontabil");
  const linha = principal?.linhas.find((l) => !l.contaVariavel && l.conta != null);
  return linha?.conta ?? null;
}

/**
 * Ajusta o componente PRINCIPAL da natureza ao que o histórico diz. Dois casos,
 * e só o principal — as linhas de tributo (PIS/COFINS a recuperar) seguem a
 * regra do Questor, que nelas não envelhece:
 *
 * - natureza com conta habitual, diferente da configurada: cobra a habitual (a
 *   do Questor é config morta);
 * - natureza genérica, sem conta dominante: a conta se decide no lançamento, e
 *   é assim que ela passa a ser tratada — como a contrapartida do fornecedor.
 *   Não há regra para cobrar, então cobrar a do plano só produziria erro falso.
 *
 * Override manual não é tocado — ele já é a decisão de quem sabe.
 */
export function aplicarContaEfetiva(
  plano: PlanoCfop[],
  mapa: Map<string, ContaEfetiva>
): PlanoCfop[] {
  if (!mapa.size) return plano;
  return plano.map((p) => {
    if (p.origem === "override" || p.cfop < CFOP_SERVICO_MIN) return p;
    const efetiva = mapa.get(`${p.estab}:${p.cfop}`);
    if (!efetiva) return p;
    const atual = contaDoPlano(p);
    if (atual == null) return p;
    if (efetiva.habitual && efetiva.contaEfetiva === atual) return p;

    const trocar = (l: LinhaPlano): LinhaPlano =>
      efetiva.habitual
        ? { ...l, conta: efetiva.contaEfetiva, descrConta: efetiva.descrEfetiva }
        : // Sem conta habitual: a conta nasce no lançamento, como a do fornecedor.
          { ...l, conta: null, descrConta: null, contaVariavel: true };

    return {
      ...p,
      contaEfetiva: {
        de: atual,
        para: efetiva.habitual ? efetiva.contaEfetiva : null,
        notas: efetiva.notas,
        acertos: efetiva.acertos,
      },
      componentes: p.componentes.map((c) =>
        c.id !== "vlrcontabil"
          ? c
          : {
              ...c,
              linhas: c.linhas.map((l) =>
                l.contaVariavel || l.conta !== atual ? l : trocar(l)
              ),
            }
      ),
    };
  });
}
