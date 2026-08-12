import "server-only";
import { appPool, appQuery } from "./app-db";

/**
 * Grupos de empresa de NEGÓCIO (tabela `grupo_empresarial`) — cadastrados no
 * módulo Configurações e consumidos por features (ex.: o Relatório Post Mortem).
 * Não confundir com `empresa_grupo` (grupo de permissão). As empresas em si vêm
 * do Questor; aqui só se guarda o `codigoempresa`.
 */

export interface GrupoEmpresaResumo {
  id: number;
  nome: string;
  empresas: number;
}

export interface GrupoEmpresaDetalhe {
  id: number;
  nome: string;
  empresas: number[];
}

export interface GrupoOpcao {
  id: number;
  nome: string;
}

export async function listarGruposEmpresa(): Promise<GrupoEmpresaResumo[]> {
  return appQuery<GrupoEmpresaResumo>(
    `select g.id, g.nome,
            (select count(*)::int from grupo_empresarial_item i where i.grupo_id = g.id) as empresas
       from grupo_empresarial g
      order by g.nome`
  );
}

export async function carregarGrupoEmpresa(id: number): Promise<GrupoEmpresaDetalhe | null> {
  const [g] = await appQuery<{ id: number; nome: string }>(
    `select id, nome from grupo_empresarial where id = $1`,
    [id]
  );
  if (!g) return null;
  const itens = await appQuery<{ codigoempresa: number }>(
    `select codigoempresa from grupo_empresarial_item where grupo_id = $1`,
    [id]
  );
  return { ...g, empresas: itens.map((i) => i.codigoempresa) };
}

export async function salvarGrupoEmpresa(dados: {
  id?: number;
  nome: string;
  empresas: number[];
}): Promise<void> {
  const client = await appPool.connect();
  try {
    await client.query("begin");
    let grupoId = dados.id;
    if (grupoId && grupoId > 0) {
      await client.query(`update grupo_empresarial set nome = $2 where id = $1`, [grupoId, dados.nome]);
    } else {
      const { rows } = await client.query(
        `insert into grupo_empresarial (nome) values ($1) returning id`,
        [dados.nome]
      );
      grupoId = rows[0].id as number;
    }
    // Substitui a lista inteira: simples e sem diff — o form manda o estado final.
    await client.query(`delete from grupo_empresarial_item where grupo_id = $1`, [grupoId]);
    for (const e of dados.empresas) {
      await client.query(
        `insert into grupo_empresarial_item (grupo_id, codigoempresa) values ($1, $2)`,
        [grupoId, e]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function excluirGrupoEmpresa(id: number): Promise<void> {
  await appQuery(`delete from grupo_empresarial where id = $1`, [id]);
}

/** Grupos para dropdown (ex.: o campo "Grupo" do Relatório Post Mortem). */
export async function gruposParaSelecao(): Promise<GrupoOpcao[]> {
  return appQuery<GrupoOpcao>(`select id, nome from grupo_empresarial order by nome`);
}
