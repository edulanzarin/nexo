import "server-only";
import type { PoolClient } from "pg";
import { appPool, appQuery, erroAppDb } from "./app-db";
import { query } from "./db";
import { FilterError } from "./fiscal-filters";
import { empresasDosGrupos, resolverGrupos } from "./grupo-membros";
import { ehModoGrupo, type ModoGrupo } from "./grupo-modo";
import {
  NOME_GRUPO_MAX,
  type DadosGrupoEmpresa,
  type EmpresaMarcavel,
  type GrupoEmpresaCadastro,
  type GrupoEmpresaDetalhe,
  type GrupoEmpresaResumo,
} from "./grupos-empresa-tipos";

export type { GrupoEmpresaCadastro, GrupoEmpresaDetalhe, GrupoEmpresaResumo } from "./grupos-empresa-tipos";

/**
 * Grupos de empresa de NEGÓCIO (tabela `grupo_empresarial`), cadastrados no
 * módulo Configurações e consumidos pelo filtro de empresa do topo e pelo
 * Relatório Post Mortem. Não confundir com `empresa_grupo` (grupo de
 * permissão). As empresas em si vêm do Questor; aqui só se guarda o
 * `codigoempresa`, e o `modo` diz se as guardadas são o grupo ou o que fica
 * fora dele (ver [[grupo-modo]]).
 */

export async function listarGruposEmpresa(): Promise<GrupoEmpresaResumo[]> {
  const grupos = await resolverGrupos("grupo_empresarial");
  return grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    modo: g.modo,
    empresas: g.membros.length,
    marcadas: g.marcadas.length,
  }));
}

/** A lista da tela de cadastro: o resumo, a última alteração e o uso no Post Mortem. */
export async function listarGruposCadastro(): Promise<GrupoEmpresaCadastro[]> {
  const [grupos, extras] = await Promise.all([
    listarGruposEmpresa(),
    // Hora no fuso da sessão do banco: o Date viraria UTC no JSON, e a data
    // passaria para o dia seguinte depois das 21h.
    appQuery<{ id: number; atualizado_em: string; relatorios: number }>(
      `select g.id,
              to_char(g.atualizado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as atualizado_em,
              (select count(*)::int from postmortem p where p.grupo_id = g.id) as relatorios
         from grupo_empresarial g`
    ),
  ]);
  const porId = new Map(extras.map((e) => [e.id, e]));
  return grupos.map((g) => ({
    ...g,
    relatorios: porId.get(g.id)?.relatorios ?? 0,
    atualizadoEm: porId.get(g.id)?.atualizado_em ?? "",
  }));
}

export async function carregarGrupoEmpresa(id: number): Promise<GrupoEmpresaDetalhe | null> {
  const [g] = await appQuery<{ id: number; nome: string; modo: ModoGrupo }>(
    `select id, nome, modo from grupo_empresarial where id = $1`,
    [id]
  );
  if (!g) return null;
  const itens = await appQuery<{ codigoempresa: number }>(
    `select codigoempresa from grupo_empresarial_item where grupo_id = $1 order by codigoempresa`,
    [id]
  );
  return { ...g, empresas: itens.map((i) => i.codigoempresa) };
}

/**
 * O universo de um grupo: todas as empresas do cadastro do Questor, sem o
 * recorte de escopo da sessão. Um grupo "todas, exceto" se resolve contra este
 * universo, e montá-lo sobre uma lista parcial inverteria as marcações errado.
 */
export async function empresasMarcaveis(): Promise<EmpresaMarcavel[]> {
  return query<EmpresaMarcavel>(`select codigoempresa as codigo, nomeempresa as nome from empresa order by nomeempresa`);
}

/** O corpo que a tela manda, conferido. Grupo em lista sem empresa não filtra nada, então não entra. */
export function lerDadosGrupo(corpo: unknown): DadosGrupoEmpresa {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const nome = typeof b.nome === "string" ? b.nome.trim().replace(/\s+/g, " ") : "";
  if (!nome) throw new FilterError("Dê um nome ao grupo");
  if (nome.length > NOME_GRUPO_MAX) throw new FilterError(`O nome passa de ${NOME_GRUPO_MAX} letras`);
  if (!ehModoGrupo(b.modo)) throw new FilterError("Modo do grupo inválido");
  const empresas = b.empresas;
  if (!Array.isArray(empresas) || !empresas.every((e) => Number.isInteger(e) && e > 0))
    throw new FilterError("Lista de empresas inválida");
  if (b.modo === "lista" && !empresas.length) throw new FilterError("Marque ao menos uma empresa");
  return { nome, modo: b.modo, empresas: empresas as number[] };
}

const nomeEmUso = (nome: string) => new FilterError(`Já existe um grupo chamado ${nome}`);

/** Cria (sem `id`) ou substitui um grupo inteiro. Devolve o id. */
export async function salvarGrupoEmpresa(dados: DadosGrupoEmpresa & { id?: number }): Promise<number> {
  const empresas = [...new Set(dados.empresas)];
  let client: PoolClient;
  try {
    client = await appPool.connect();
  } catch (err) {
    throw erroAppDb(err);
  }
  try {
    await client.query("begin");
    // O índice único do nome diferencia maiúscula: "U FIT" e "U Fit" passariam
    // como dois grupos, e o seletor mostraria os dois.
    const { rows: iguais } = await client.query(
      `select 1 from grupo_empresarial where lower(nome) = lower($1) and id <> $2 limit 1`,
      [dados.nome, dados.id ?? 0]
    );
    if (iguais.length) throw nomeEmUso(dados.nome);

    let grupoId: number;
    if (dados.id) {
      const { rowCount } = await client.query(`update grupo_empresarial set nome = $2, modo = $3 where id = $1`, [
        dados.id,
        dados.nome,
        dados.modo,
      ]);
      if (!rowCount) throw new FilterError("O grupo não existe mais. Alguém pode ter removido enquanto você editava.");
      grupoId = dados.id;
    } else {
      const { rows } = await client.query(`insert into grupo_empresarial (nome, modo) values ($1, $2) returning id`, [
        dados.nome,
        dados.modo,
      ]);
      grupoId = rows[0].id as number;
    }
    // Substitui a lista inteira: a tela manda o estado final. Um insert só, e
    // não um por empresa: grupo de "todas, exceto" montado em lista passa de
    // 1.400 linhas, e 1.400 idas ao banco seguravam a transação por segundos.
    await client.query(`delete from grupo_empresarial_item where grupo_id = $1`, [grupoId]);
    if (empresas.length)
      await client.query(
        `insert into grupo_empresarial_item (grupo_id, codigoempresa) select $1, unnest($2::int[])`,
        [grupoId, empresas]
      );
    await client.query("commit");
    return grupoId;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    if (err instanceof FilterError) throw err;
    // Duas pessoas criando o mesmo nome ao mesmo tempo passam pela conferência
    // acima; quem decide é o índice único.
    if ((err as { code?: string })?.code === "23505") throw nomeEmUso(dados.nome);
    throw erroAppDb(err);
  } finally {
    client.release();
  }
}

/**
 * Remove o grupo. Grupo usado num relatório do Post Mortem fica: a chave
 * estrangeira recusaria com um erro de banco, e a tela diz antes o que fazer.
 */
export async function excluirGrupoEmpresa(id: number): Promise<void> {
  const [uso] = await appQuery<{ relatorios: number }>(
    `select count(*)::int as relatorios from postmortem where grupo_id = $1`,
    [id]
  );
  if (uso.relatorios > 0)
    throw new FilterError(
      `${uso.relatorios === 1 ? "Um relatório" : `${uso.relatorios} relatórios`} do Post Mortem ${
        uso.relatorios === 1 ? "usa" : "usam"
      } este grupo, e ele não pode ser removido. Renomeie ou troque as empresas dele.`
    );
  await appQuery(`delete from grupo_empresarial where id = $1`, [id]);
}

/**
 * Empresas de um ou mais grupos, sem repetição. É o que transforma "grupo" em
 * filtro de consulta: o cliente manda os IDs do grupo e o funil de escopo os
 * resolve AQUI, no servidor — a lista de empresas nunca vem do navegador.
 * Grupo sem empresa devolve nada, e é o chamador que decide o que isso significa.
 */
export async function empresasDeGrupos(ids: number[]): Promise<number[]> {
  return empresasDosGrupos("grupo_empresarial", ids);
}
