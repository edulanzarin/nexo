import "server-only";
import { query } from "./db";
import { escopoEfetivo, parseFilters, type FiscalFilters } from "./fiscal-filters";

/**
 * PEÇAS COMUNS DAS ABAS DE PRODUTIVIDADE DO CONTÁBIL.
 *
 * A seção mede o trabalho do time por cinco ângulos — Lançamentos, Exclusões,
 * Atraso, Carteira e Tempo —, e cada ângulo tem sua própria varredura. O que
 * NÃO muda entre eles mora aqui: o escopo de empresa da sessão, os buckets
 * densos da série, os nomes de usuário/empresa/origem e a mediana ponderada.
 *
 * Sem isto cada aba recopiaria o funil de escopo — e escopo copiado é escopo
 * que um dia esquece de filtrar.
 */

export type ProdFiltros = FiscalFilters;

export function parseProdFiltros(sp: URLSearchParams): ProdFiltros {
  return parseFilters(sp);
}

/**
 * Escopo efetivo: "todas" (sem restrição) ou a interseção sessão × pedido
 * (empresas marcadas ∪ empresas dos grupos). Um delegate de propósito — o funil
 * mora em `fiscal-filters`, e escopo com duas implementações é escopo que um dia
 * diverge.
 */
export async function escopoEmpresas(f: ProdFiltros): Promise<number[] | "todas"> {
  return escopoEfetivo(f);
}

/**
 * Condições de empresa (e filial) já com o escopo da sessão aplicado. Empurra os
 * parâmetros no array recebido e devolve os pedaços de SQL — o chamador escreve
 * o recorte de período, que é diferente em cada aba.
 *
 * `filial: false` para fonte que não tem `codigoestab` (o `tempouso` guarda só
 * empresa) — aí o filtro de filial não tem onde morder e é ignorado de propósito.
 */
export async function condEscopo(
  f: ProdFiltros,
  params: unknown[],
  opts: { filial?: boolean; coluna?: string } = {}
): Promise<string[]> {
  const col = opts.coluna ?? "codigoempresa";
  const conds: string[] = [];
  const escopo = await escopoEmpresas(f);
  if (escopo !== "todas") {
    params.push(escopo);
    conds.push(`${col} = any($${params.length}::int[])`);
  }
  if (opts.filial !== false && f.estabs.length > 0) {
    params.push(f.estabs);
    conds.push(`codigoestab = any($${params.length}::int[])`);
  }
  return conds;
}

/** Período longo demais para grade diária vira série mensal (mesma régua do Fiscal). */
export function granularidadeDe(inicio: string, fim: string): "dia" | "mes" {
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000 + 1;
  return dias > 92 ? "mes" : "dia";
}

/** Buckets densos do período (dia ou mês) — sem furo, para a série não mentir. */
export function buckets(inicio: string, fim: string, granularidade: "dia" | "mes"): string[] {
  const out: string[] = [];
  const ini = new Date(inicio + "T00:00:00Z");
  const end = new Date(fim + "T00:00:00Z");
  if (granularidade === "mes") {
    const cur = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), 1));
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return out;
  }
  for (const t = new Date(ini); t <= end; t.setUTCDate(t.getUTCDate() + 1)) {
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

/** Dia "YYYY-MM-DD" → chave do bucket (o próprio dia, ou o 1º do mês). */
export const bucketDe = (d: string, granularidade: "dia" | "mes") =>
  granularidade === "mes" ? d.slice(0, 7) + "-01" : d;

/**
 * Percentil de uma distribuição PONDERADA (valor → quantas vezes ocorre). O grão
 * já chega agregado do banco, então a mediana sai daí em vez de uma segunda
 * varredura só para o `percentile_disc`. Devolve null quando não há amostra.
 */
export function percentilPonderado(pesos: Map<number, number>, p: number): number | null {
  let total = 0;
  for (const n of pesos.values()) total += n;
  if (total === 0) return null;
  const alvo = total * p;
  let acumulado = 0;
  for (const valor of [...pesos.keys()].sort((a, b) => a - b)) {
    acumulado += pesos.get(valor) ?? 0;
    if (acumulado >= alvo) return valor;
  }
  return null;
}

/** Soma dois mapas de contagem no lugar (o da esquerda). */
export function somarMapa<K>(destino: Map<K, number>, chave: K, n: number): void {
  destino.set(chave, (destino.get(chave) ?? 0) + n);
}

export interface Cadastros {
  nomeUsuario(codigo: number): string;
  usuarioInativo(codigo: number): boolean;
  nomeEmpresa(codigo: number): string;
  nomeOrigem(codigo: string): string;
}

/**
 * Nomes de apoio do que apareceu na varredura. Empresa entra por lista (a
 * varredura já sabe quais tocou); usuário e origem são cadastros pequenos e vêm
 * inteiros.
 *
 * Usuário 0 é o ADMINISTRADOR do Questor (rotinas automáticas) — tem de ficar
 * legível na tela, mas não é ninguém do time.
 */
export async function carregarCadastros(opts: {
  empresas?: number[];
  origens?: boolean;
}): Promise<Cadastros> {
  const codigosEmpresa = opts.empresas ?? [];
  const [usuarios, nomesEmpresa, descrOrigem] = await Promise.all([
    query<{ codigo: number; nome: string | null; inativo: boolean }>(
      `select codigousuario as codigo,
              coalesce(nullif(btrim(nomeusuariocompl), ''), nullif(btrim(nomeusuario), '')) as nome,
              (databaixausuario is not null) as inativo
         from usuario`
    ),
    codigosEmpresa.length
      ? query<{ codigo: number; nome: string | null }>(
          `select codigoempresa as codigo, btrim(nomeempresa) as nome
             from empresa where codigoempresa = any($1::int[])`,
          [codigosEmpresa]
        )
      : Promise.resolve([]),
    opts.origens
      ? query<{ codigo: string; descr: string | null }>(
          `select codigooriglctoctb as codigo, btrim(descroriglctoctb) as descr from origemlctoctb`
        )
      : Promise.resolve([]),
  ]);

  const mapaUsuario = new Map(usuarios.map((u) => [u.codigo, u]));
  const mapaEmpresa = new Map(nomesEmpresa.map((e) => [e.codigo, e.nome]));
  const mapaOrigem = new Map(descrOrigem.map((o) => [o.codigo, o.descr]));

  return {
    nomeUsuario: (c) =>
      c === 0 ? "Sistema (automático)" : mapaUsuario.get(c)?.nome || `Usuário ${c}`,
    usuarioInativo: (c) => mapaUsuario.get(c)?.inativo ?? false,
    nomeEmpresa: (c) => mapaEmpresa.get(c) || `Empresa ${c}`,
    nomeOrigem: (c) => mapaOrigem.get(c) || (c === "--" ? "Sem origem" : `Origem ${c}`),
  };
}
