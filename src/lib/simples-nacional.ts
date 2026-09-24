import "server-only";
import { query } from "./db";

/**
 * Quem é do Simples Nacional, e DESDE QUANDO.
 *
 * A fonte é `opcaossimplesfederal`: um histórico de marcos por empresa, não um
 * campo de regime. Cada linha diz "a partir desta data, a empresa apura (ou
 * deixa de apurar) o Simples" — 862 linhas cobrindo 663 empresas. Não existe
 * coluna de regime em `empresa` nem em `estab` (ver [[Cadastros centrais do
 * Questor - empresa, estab, pessoa]]); quem procurar por ela não acha.
 *
 * Duas armadilhas, as duas verificadas no banco em set/2026:
 *
 * 1. **A saída marca o ÚLTIMO dia apurado, não o primeiro dia fora.** Entrada
 *    (`apurassimplesfederal = '1'`) cai sempre no dia 1 do mês; saída ('0')
 *    sempre no último dia. Verificado: 708 de 708 e 154 de 154. A empresa 995
 *    tem saída em 30/06/2026 e apurou junho — tratar a data da saída como
 *    "primeiro dia fora" perde a última competência de toda empresa que saiu.
 *
 * 2. **O corte é a COMPETÊNCIA da nota, não a data dela.** Pela regra acima,
 *    uma nota de 30/06/2026 é do Simples embora exista um marco de saída com a
 *    mesma data. Por isso todo teste aqui compara o dia 1 do mês da nota, e não
 *    a data do documento.
 *
 * Calibrado contra a apuração real: das 6.134 competências que o escritório
 * apurou como Simples desde 2024 (`totalssimplesfederal`), esta regra casa
 * 6.128. As 6 restantes são 2 empresas que apuraram antes de ter marco
 * cadastrado — falta de cadastro, não erro da regra. Nenhuma competência
 * apurada é classificada como "fora".
 */

/**
 * Vigência em intervalos fechados `[inicio, fim]`, prontos para casar com uma
 * competência. Os intervalos de uma mesma empresa NÃO se sobrepõem (verificado:
 * zero pares), então dá para juntar sem duplicar a nota — dois marcos de entrada
 * seguidos são mudança de configuração, e o primeiro fecha na véspera do segundo.
 */
const VIGENCIA = `
  with marcos as (
    select codigoempresa,
           datassimplesfederal as inicio,
           apurassimplesfederal as apura,
           lead(datassimplesfederal) over w as prox_data,
           lead(apurassimplesfederal) over w as prox_apura
    from opcaossimplesfederal
    window w as (partition by codigoempresa order by datassimplesfederal)
  ),
  vigencia as (
    select codigoempresa, inicio,
           case
             when prox_data is null then date '2100-12-31'
             -- saída: a data dela É o último dia apurado, entra no intervalo
             when prox_apura = '0' then prox_data
             -- outro marco de entrada (troca de config): fecha na véspera
             else prox_data - 1
           end as fim
    from marcos
    where apura = '1'
  )`;

/** A competência de uma data: o dia 1 do mês. É por ela que o regime se decide. */
export function competenciaDe(data: string): string {
  return data.slice(0, 7) + "-01";
}

/**
 * Empresas com o Simples vigente na competência (aceita `YYYY-MM-DD` ou
 * `YYYY-MM`). Ordenado por código, para a lista ser estável entre chamadas.
 */
export async function empresasNoSimples(competencia: string): Promise<number[]> {
  const ref = competenciaDe(competencia);
  const rows = await query<{ codigoempresa: number }>(
    `${VIGENCIA}
     select distinct codigoempresa from vigencia
     where $1::date between inicio and fim
     order by codigoempresa`,
    [ref]
  );
  return rows.map((r) => r.codigoempresa);
}

/** Uma faixa em que a empresa esteve (ou está) no Simples. */
export interface VigenciaSimples {
  empresa: number;
  inicio: string;
  /** `2100-12-31` é a sentinela de "segue valendo" — o mesmo truque do `estab.dataencerativ`. */
  fim: string;
}

/** Histórico de vigência de uma empresa: para a tela dizer desde quando, e até quando. */
export async function vigenciasDaEmpresa(empresa: number): Promise<VigenciaSimples[]> {
  return query<VigenciaSimples>(
    `${VIGENCIA}
     select codigoempresa as empresa, inicio::text, fim::text
     from vigencia where codigoempresa = $1 order by inicio`,
    [empresa]
  );
}

/**
 * Condição SQL para recortar notas às empresas do Simples, mês a mês: uma
 * empresa que saiu em março entra com as notas até março e some depois, dentro
 * do MESMO período consultado. `exists` em vez de `join` porque o intervalo
 * responde por empresa e não deve multiplicar a linha da nota.
 *
 * `alias` é o da tabela de notas (`lctofisent`/`lctofissai`). Devolve SQL sem
 * parâmetro: a vigência sai inteira do banco, nada vem do cliente.
 */
export function condicaoNotaDeEmpresaSimples(alias = "f"): string {
  return `exists (
    ${VIGENCIA}
    select 1 from vigencia v
    where v.codigoempresa = ${alias}.codigoempresa
      and date_trunc('month', ${alias}.datalctofis)::date between v.inicio and v.fim
  )`;
}
