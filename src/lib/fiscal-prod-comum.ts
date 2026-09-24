import "server-only";
import { query } from "./db";
import { condEscopo, type ProdFiltros } from "./prod-comum";

/**
 * PEÇAS COMUNS DAS ABAS DE PRODUTIVIDADE DO FISCAL.
 *
 * O que vale para os dois módulos está em `prod-comum`; aqui fica só o que é do
 * Fiscal: o recorte de período pelo carimbo de digitação, o filtro de espécie e
 * os nomes de usuário e empresa.
 */

/**
 * WHERE do período de TRABALHO. `datahoralctofis` é timestamp: o fim entra como
 * `< fim + 1 dia` para pegar o dia inteiro (`between` cortaria à meia-noite).
 *
 * O `alias` existe porque as consultas de imposto leem o cabeçalho junto com a
 * tabela de detalhe, e aí toda coluna precisa de dono.
 */
export async function whereTrabalho(
  f: ProdFiltros,
  opts: { alias?: string; incluirCanceladas?: boolean } = {}
): Promise<{ sql: string; params: unknown[] }> {
  const a = opts.alias ? `${opts.alias}.` : "";
  const params: unknown[] = [f.inicio, f.fim];
  const conds = [`${a}datahoralctofis >= $1::date and ${a}datahoralctofis < ($2::date + 1)`];
  conds.push(...(await condEscopo(f, params, { alias: opts.alias })));
  conds.push(...condEspecie(f, params, a));
  // Cancelada é trabalho FEITO: alguém digitou a nota antes de ela morrer. A
  // seção conta por padrão e destaca o número à parte — esconder faria a
  // produtividade de quem lança muita nota cancelada sumir sem explicação.
  if (opts.incluirCanceladas === false) conds.push(`${a}cancelada <> '1'`);
  return { sql: conds.join(" and "), params };
}

/** Filtro de espécie da barra, com o "OUTRAS" invertido (o que não é principal). */
function condEspecie(f: ProdFiltros, params: unknown[], a: string): string[] {
  if (f.especies.length === 0) return [];
  const principais = ["NFE", "CTE", "NFSE", "NFCE", "NF"];
  const listadas = f.especies.filter((e) => e !== "OUTRAS");
  const parts: string[] = [];
  if (listadas.length > 0) {
    params.push(listadas);
    parts.push(`upper(btrim(${a}especienf)) = any($${params.length}::text[])`);
  }
  if (f.especies.includes("OUTRAS")) {
    params.push(principais);
    parts.push(`upper(btrim(${a}especienf)) <> all($${params.length}::text[])`);
  }
  return [`(${parts.join(" or ")})`];
}

export interface CadastrosFiscal {
  nomeUsuario(codigo: number): string;
  usuarioInativo(codigo: number): boolean;
  nomeEmpresa(codigo: number): string;
}

/**
 * Nomes de apoio do que apareceu na varredura. Empresa entra por lista (a
 * varredura já sabe quais tocou); usuário é cadastro pequeno e vem inteiro.
 *
 * Usuário 0 é o ADMINISTRADOR do Questor — a conta em que caem as rotinas
 * automáticas. Tem de ficar legível na tela, mas não é ninguém do time.
 */
export async function carregarCadastrosFiscal(empresas: number[]): Promise<CadastrosFiscal> {
  const [usuarios, nomesEmpresa] = await Promise.all([
    query<{ codigo: number; nome: string | null; inativo: boolean }>(
      `select codigousuario as codigo,
              coalesce(nullif(btrim(nomeusuariocompl), ''), nullif(btrim(nomeusuario), '')) as nome,
              (databaixausuario is not null) as inativo
         from usuario`
    ),
    empresas.length
      ? query<{ codigo: number; nome: string | null }>(
          `select codigoempresa as codigo, btrim(nomeempresa) as nome
             from empresa where codigoempresa = any($1::int[])`,
          [empresas]
        )
      : Promise.resolve([]),
  ]);

  const mapaUsuario = new Map(usuarios.map((u) => [u.codigo, u]));
  const mapaEmpresa = new Map(nomesEmpresa.map((e) => [e.codigo, e.nome]));

  return {
    nomeUsuario: (c) =>
      c === 0 ? "Sistema (automático)" : mapaUsuario.get(c)?.nome || `Usuário ${c}`,
    usuarioInativo: (c) => mapaUsuario.get(c)?.inativo ?? false,
    nomeEmpresa: (c) => mapaEmpresa.get(c) || `Empresa ${c}`,
  };
}
