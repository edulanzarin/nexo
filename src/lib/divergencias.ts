import type { Divergencia, LinhaPlano, PlanoCfop } from "./types";

/** Centavos de tolerância — arredondamento de rateio não é erro. */
const TOLERANCIA = 0.02;

/** Um lançamento contábil realmente gerado para a nota. */
export interface LancamentoReal {
  contaDeb: number | null;
  contaCred: number | null;
  valor: number;
}

/** Valores da nota disponíveis para avaliar as fórmulas do Questor. */
export interface ValoresNota {
  vlrContabil: number;
  vlrICMS: number;
  vlrIPI: number;
  vlrFunRural: number;
}

/**
 * Avalia uma fórmula do Questor (ex.: "vlrContabil-vlrIPI-vlrICMS").
 * Só soma e subtração aparecem nessas regras. Devolve null quando algum token
 * não é conhecido — aí o valor não é conferido, para não gerar falso positivo.
 */
export function avaliarRegra(regra: string | null, v: ValoresNota): number | null {
  if (!regra) return null;
  const tokens = regra.split(/(?=[+-])/);
  let total = 0;
  for (const bruto of tokens) {
    const t = bruto.trim();
    if (!t) continue;
    const sinal = t.startsWith("-") ? -1 : 1;
    const nome = t.replace(/^[+-]/, "").trim();
    const valor = (v as unknown as Record<string, number | undefined>)[nome];
    if (valor == null) return null;
    total += sinal * valor;
  }
  return total;
}

/** Contas fixas que o plano espera, separadas por natureza. */
function contasEsperadas(plano: PlanoCfop[]): {
  debito: Map<number, LinhaPlano>;
  credito: Map<number, LinhaPlano>;
  aceitaVariavelDeb: boolean;
  aceitaVariavelCred: boolean;
  /** Contas alcançadas por CFOPs com fórmulas de valor diferentes. */
  ambiguas: Set<string>;
} {
  const debito = new Map<number, LinhaPlano>();
  const credito = new Map<number, LinhaPlano>();
  const ambiguas = new Set<string>();
  let aceitaVariavelDeb = false;
  let aceitaVariavelCred = false;

  for (const p of plano) {
    for (const comp of p.componentes) {
      for (const l of comp.linhas) {
        if (l.contaVariavel) {
          if (l.natureza === 1) aceitaVariavelDeb = true;
          else aceitaVariavelCred = true;
          continue;
        }
        if (l.conta == null) continue;
        const alvo = l.natureza === 1 ? debito : credito;
        const anterior = alvo.get(l.conta);
        // Mesma conta vinda de dois CFOPs com regras distintas: não dá para
        // saber qual valor cobrar, então o valor dela não é conferido.
        if (anterior && anterior.regraValor !== l.regraValor) {
          ambiguas.add(`${l.natureza}:${l.conta}`);
        }
        alvo.set(l.conta, l);
      }
    }
  }
  return { debito, credito, aceitaVariavelDeb, aceitaVariavelCred, ambiguas };
}

export interface OpcoesConferencia {
  /**
   * Contas que comprovadamente recebem lançamento POR NOTA no período, no
   * formato "natureza:conta". Nem todo componente do plano vira lançamento na
   * nota: ICMS e IPI de saída, por exemplo, são contabilizados na apuração
   * mensal (chaveorigem 'IM'), não nota a nota. Cobrar esses por nota geraria
   * milhares de falsos positivos, então só se cobra o que se observa acontecer.
   */
  observadas: Set<string>;
  /**
   * Conferir valores. Só é confiável em nota de CFOP único: com vários CFOPs
   * não dá para atribuir a cada um a sua parcela dos tributos.
   */
  checarValor: boolean;
}

/**
 * Compara os lançamentos que a nota gerou com os que o plano manda gerar.
 *
 * Cuidados para não inventar erro:
 * - conta variável (fornecedor/cliente) não tem número fixo, então qualquer
 *   conta é aceita naquela natureza;
 * - lançamento cujo valor daria zero (imposto que a nota não tem) não é
 *   gerado pelo Questor — ausência ali é correta, não é "faltando";
 * - valor só é conferido quando a fórmula é avaliável com o que temos.
 */
export function conferirNota(
  lancamentos: LancamentoReal[],
  plano: PlanoCfop[],
  valores: ValoresNota,
  opcoes: OpcoesConferencia
): Divergencia[] {
  const divs: Divergencia[] = [];
  if (!plano.length) return divs;

  const { debito, credito, aceitaVariavelDeb, aceitaVariavelCred, ambiguas } =
    contasEsperadas(plano);

  // Soma o que foi lançado em cada conta, por natureza.
  const lancadoDeb = new Map<number, number>();
  const lancadoCred = new Map<number, number>();
  for (const l of lancamentos) {
    if (l.contaDeb != null) lancadoDeb.set(l.contaDeb, (lancadoDeb.get(l.contaDeb) ?? 0) + l.valor);
    if (l.contaCred != null) {
      lancadoCred.set(l.contaCred, (lancadoCred.get(l.contaCred) ?? 0) + l.valor);
    }
  }

  // 1) Conta inesperada e 2) natureza invertida
  for (const [natureza, lancado, esperado, oposto, aceitaVariavel] of [
    [1, lancadoDeb, debito, credito, aceitaVariavelDeb],
    [-1, lancadoCred, credito, debito, aceitaVariavelCred],
  ] as const) {
    for (const [conta, valor] of lancado) {
      if (esperado.has(conta)) continue;
      if (oposto.has(conta)) {
        divs.push({
          tipo: "natureza",
          natureza,
          componente: `Conta ${conta}`,
          detalhe: `Conta ${conta} foi lançada a ${rotuloNatureza(natureza).toLowerCase()}, mas o plano espera ${rotuloNatureza(-natureza as 1 | -1).toLowerCase()}`,
          contaEsperada: conta,
          contaLancada: conta,
          valorEsperado: null,
          valorLancado: valor,
        });
        continue;
      }
      // Sem conta fixa correspondente: só é aceitável se o plano previr conta
      // variável nessa natureza (fornecedor/cliente).
      if (aceitaVariavel) continue;
      divs.push({
        tipo: "conta",
        natureza,
        componente: `Conta ${conta}`,
        detalhe: `Conta ${conta} não está no plano de contabilização deste CFOP`,
        contaEsperada: null,
        contaLancada: conta,
        valorEsperado: null,
        valorLancado: valor,
      });
    }
  }

  // 3) Lançamento faltando e 4) valor divergente
  for (const [natureza, lancado, esperado] of [
    [1, lancadoDeb, debito],
    [-1, lancadoCred, credito],
  ] as const) {
    for (const [conta, linha] of esperado) {
      // Componente que não é contabilizado nota a nota (vai na apuração mensal).
      if (!opcoes.observadas.has(`${natureza}:${conta}`)) continue;

      const podeValor = opcoes.checarValor && !ambiguas.has(`${natureza}:${conta}`);
      const esperadoValor = podeValor ? avaliarRegra(linha.regraValor, valores) : null;
      const valorLancado = lancado.get(conta);

      if (valorLancado == null) {
        // Imposto que a nota não tem: o Questor não gera o lançamento. Correto.
        if (esperadoValor == null || Math.abs(esperadoValor) < TOLERANCIA) continue;
        divs.push({
          tipo: "faltando",
          natureza,
          componente: linha.descrConta ?? `Conta ${conta}`,
          detalhe: `Esperado ${rotuloNatureza(natureza).toLowerCase()} de ${esperadoValor.toFixed(2)} na conta ${conta}, não gerado`,
          contaEsperada: conta,
          contaLancada: null,
          valorEsperado: esperadoValor,
          valorLancado: null,
        });
        continue;
      }

      if (esperadoValor == null) continue;
      if (Math.abs(valorLancado - esperadoValor) > TOLERANCIA) {
        divs.push({
          tipo: "valor",
          natureza,
          componente: linha.descrConta ?? `Conta ${conta}`,
          detalhe: `Conta ${conta}: lançado ${valorLancado.toFixed(2)}, esperado ${esperadoValor.toFixed(2)} (${linha.regraValor})`,
          contaEsperada: conta,
          contaLancada: conta,
          valorEsperado: esperadoValor,
          valorLancado,
        });
      }
    }
  }

  return divs;
}

function rotuloNatureza(n: 1 | -1): string {
  return n === 1 ? "Débito" : "Crédito";
}
