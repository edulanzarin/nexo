import "server-only";
import { appPool, appQuery } from "./app-db";
import { empresasDosGrupos, resolverGrupos } from "./grupo-membros";
import type { ModoGrupo } from "./grupo-modo";

/**
 * Grupos de empresa de NEGÓCIO (tabela `grupo_empresarial`) — cadastrados no
 * módulo Configurações e consumidos por features (ex.: o Relatório Post Mortem).
 * Não confundir com `empresa_grupo` (grupo de permissão). As empresas em si vêm
 * do Questor; aqui só se guarda o `codigoempresa`, e o `modo` diz se as
 * guardadas são o grupo ou o que fica fora dele (ver [[grupo-modo]]).
 */

export interface GrupoEmpresaResumo {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** Quantas empresas o grupo tem hoje. */
  empresas: number;
  /** Quantas estão marcadas — no modo `exceto`, as que ficam de fora. */
  marcadas: number;
}

export interface GrupoEmpresaDetalhe {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** As marcadas, como estão gravadas (dentro ou fora, conforme o modo). */
  empresas: number[];
}

export interface GrupoOpcao {
  id: number;
  nome: string;
}

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

export async function carregarGrupoEmpresa(id: number): Promise<GrupoEmpresaDetalhe | null> {
  const [g] = await appQuery<{ id: number; nome: string; modo: ModoGrupo }>(
    `select id, nome, modo from grupo_empresarial where id = $1`,
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
  modo: ModoGrupo;
  empresas: number[];
}): Promise<void> {
  const client = await appPool.connect();
  try {
    await client.query("begin");
    let grupoId = dados.id;
    if (grupoId && grupoId > 0) {
      await client.query(`update grupo_empresarial set nome = $2, modo = $3 where id = $1`, [
        grupoId,
        dados.nome,
        dados.modo,
      ]);
    } else {
      const { rows } = await client.query(
        `insert into grupo_empresarial (nome, modo) values ($1, $2) returning id`,
        [dados.nome, dados.modo]
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

/**
 * Empresas de um ou mais grupos, sem repetição. É o que transforma "grupo" em
 * filtro de consulta: o cliente manda os IDs do grupo e o funil de escopo os
 * resolve AQUI, no servidor — a lista de empresas nunca vem do navegador.
 * Grupo sem empresa devolve nada, e é o chamador que decide o que isso significa.
 */
export async function empresasDeGrupos(ids: number[]): Promise<number[]> {
  return empresasDosGrupos("grupo_empresarial", ids);
}
