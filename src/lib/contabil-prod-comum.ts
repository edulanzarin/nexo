import "server-only";
import { query } from "./db";

/**
 * CADASTROS DE APOIO DA PRODUTIVIDADE DO CONTÁBIL — os nomes de usuário,
 * empresa e origem que a varredura precisa para virar tela.
 *
 * O resto das peças comuns (escopo, buckets, estatística) é dos DOIS módulos e
 * mora em `prod-comum`; re-exportado aqui só para as abas do Contábil não terem
 * de mudar de porta de entrada.
 */

export {
  bucketDe,
  buckets,
  condEscopo,
  escopoEmpresas,
  granularidadeDe,
  parseProdFiltros,
  percentilPonderado,
  somarMapa,
} from "./prod-comum";
export type { ProdFiltros } from "./prod-comum";

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
