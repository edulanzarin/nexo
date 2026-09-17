import "server-only";
import { appQuery } from "./app-db";
import { codigosEmpresasQuestor } from "./empresas-questor";
import { membrosDoGrupo, type ModoGrupo } from "./grupo-modo";

/**
 * Resolve quem está em cada grupo de empresa, nos dois cadastros: permissão
 * (`empresa_grupo`) e negócio (`grupo_empresarial`). É o ÚNICO lugar que lê a
 * tabela de itens para dizer "estas são as empresas do grupo" — sessão, filtro
 * por grupo e contagem das telas passam por aqui, para nenhum esquecer o modo
 * `exceto` e voltar a tratar as marcadas como o grupo.
 */

/** Nome fechado: vira identificador no SQL, então nunca vem de input. */
export type TabelaGrupo = "empresa_grupo" | "grupo_empresarial";

export interface GrupoResolvido {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** O que está gravado: dentro (lista) ou fora (exceto). */
  marcadas: number[];
  /** Quem está no grupo agora. */
  membros: number[];
}

/** Todos os grupos da tabela, ou só os `ids` pedidos. */
export async function resolverGrupos(tabela: TabelaGrupo, ids?: number[]): Promise<GrupoResolvido[]> {
  if (ids && !ids.length) return [];
  const rows = await appQuery<{ id: number; nome: string; modo: ModoGrupo; marcadas: number[] }>(
    `select g.id, g.nome, g.modo,
            coalesce(array_agg(i.codigoempresa) filter (where i.codigoempresa is not null), '{}') as marcadas
       from ${tabela} g
       left join ${tabela}_item i on i.grupo_id = g.id
      ${ids ? "where g.id = any($1::int[])" : ""}
      group by g.id, g.nome, g.modo
      order by g.nome`,
    ids ? [ids] : []
  );
  // O Questor só é consultado se algum grupo precisa do universo.
  const universo = rows.some((r) => r.modo === "exceto") ? await codigosEmpresasQuestor() : [];
  return rows.map((r) => ({ ...r, membros: membrosDoGrupo(r.modo, r.marcadas, universo) }));
}

/** União das empresas de vários grupos, sem repetição. */
export async function empresasDosGrupos(tabela: TabelaGrupo, ids: number[]): Promise<number[]> {
  const grupos = await resolverGrupos(tabela, ids);
  return [...new Set(grupos.flatMap((g) => g.membros))];
}
