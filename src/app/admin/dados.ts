import "server-only";
import { appQuery } from "@/lib/app-db";
import { query } from "@/lib/db";
import { resolverGrupos } from "@/lib/grupo-membros";
import type { ModoGrupo } from "@/lib/grupo-modo";

/**
 * Leituras da área admin. Usuários/grupos/cargos vêm do banco do app; a lista de
 * empresas vem do Questor (read-only) — o admin monta o escopo escolhendo entre
 * TODAS as empresas, independente do escopo dele.
 *
 * Modelo: o CARGO concentra toda a permissão (seções + grupos de empresa + os
 * flags admin e "vê todas as empresas"). A pessoa recebe UM OU MAIS cargos
 * (usuario_cargo) e o acesso é a UNIÃO deles — não há ajuste por usuário.
 */

export interface UsuarioDetalhe {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  /** Timestamp da foto (ms), para cache-buster no <img>; null = sem foto. */
  avatarVersao: number | null;
  /** Cargos atribuídos (ids). Toda a permissão vem deles. */
  cargos: number[];
}

export async function carregarUsuario(id: string): Promise<UsuarioDetalhe | null> {
  const [u] = await appQuery<{
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
    ativo: boolean;
    avatar_versao: string | null;
  }>(
    `select u.id, u.nome, u.email, u.telefone, u.ativo,
            extract(epoch from a.atualizado_em) * 1000 as avatar_versao
       from usuario u
       left join usuario_avatar a on a.usuario_id = u.id
      where u.id = $1`,
    [id]
  );
  if (!u) return null;

  const cargos = await appQuery<{ cargo_id: number }>(
    `select cargo_id from usuario_cargo where usuario_id = $1`,
    [id]
  );

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone,
    ativo: u.ativo,
    avatarVersao: u.avatar_versao != null ? Math.round(Number(u.avatar_versao)) : null,
    cargos: cargos.map((c) => c.cargo_id),
  };
}

export interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  /** Nomes dos cargos atribuídos, para exibição. */
  cargos: string[];
  ativo: boolean;
  admin: boolean;
  todasEmpresas: boolean;
  ultimo_acesso: string | null;
  avatarVersao: number | null;
}

/** Lista de usuários para a tela de administração (rica, ordenada por nome). */
export async function listarUsuarios(): Promise<UsuarioLista[]> {
  const rows = await appQuery<{
    id: string;
    nome: string;
    email: string;
    cargos: string[] | null;
    ativo: boolean;
    admin: boolean;
    todas_empresas: boolean;
    ultimo_acesso: string | null;
    avatar_versao: string | null;
  }>(
    `select u.id, u.nome, u.email, u.ativo,
            coalesce(array_agg(c.nome order by c.nome) filter (where c.id is not null), '{}') as cargos,
            coalesce(bool_or(c.admin), false) as admin,
            coalesce(bool_or(c.todas_empresas), false) as todas_empresas,
            to_char(u.ultimo_acesso, 'YYYY-MM-DD"T"HH24:MI:SS') as ultimo_acesso,
            extract(epoch from av.atualizado_em) * 1000 as avatar_versao
       from usuario u
       left join usuario_cargo uc on uc.usuario_id = u.id
       left join cargo c on c.id = uc.cargo_id
       left join usuario_avatar av on av.usuario_id = u.id
      group by u.id, av.atualizado_em
      order by u.nome`
  );
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    email: r.email,
    cargos: r.cargos ?? [],
    ativo: r.ativo,
    admin: r.admin,
    todasEmpresas: r.admin || r.todas_empresas,
    ultimo_acesso: r.ultimo_acesso,
    avatarVersao: r.avatar_versao != null ? Math.round(Number(r.avatar_versao)) : null,
  }));
}

// ---------------------------------------------------------------- Cargos/setores

export interface SetorResumo {
  id: number;
  nome: string;
  cargos: number;
}

export async function listarSetores(): Promise<SetorResumo[]> {
  return appQuery<SetorResumo>(
    `select s.id, s.nome, count(c.id)::int as cargos
       from setor s
       left join cargo c on c.setor_id = s.id
      group by s.id
      order by s.nome`
  );
}

export interface SetorOpcao {
  id: number;
  nome: string;
}

export async function carregarSetor(id: number): Promise<SetorOpcao | null> {
  const [s] = await appQuery<SetorOpcao>(`select id, nome from setor where id = $1`, [id]);
  return s ?? null;
}

export interface CargoResumo {
  id: number;
  nome: string;
  setorNome: string | null;
  admin: boolean;
  secoes: number;
  grupos: number;
  usuarios: number;
}

export async function listarCargos(): Promise<CargoResumo[]> {
  const rows = await appQuery<{
    id: number;
    nome: string;
    setor_nome: string | null;
    admin: boolean;
    secoes: number;
    grupos: number;
    usuarios: number;
  }>(
    `select c.id, c.nome, st.nome as setor_nome, c.admin,
            (select count(*)::int from cargo_secao cs where cs.cargo_id = c.id) as secoes,
            (select count(*)::int from cargo_grupo cg where cg.cargo_id = c.id) as grupos,
            (select count(*)::int from usuario_cargo uc where uc.cargo_id = c.id) as usuarios
       from cargo c
       left join setor st on st.id = c.setor_id
      order by st.nome nulls last, c.nome`
  );
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    setorNome: r.setor_nome,
    admin: r.admin,
    secoes: r.secoes,
    grupos: r.grupos,
    usuarios: r.usuarios,
  }));
}

export interface CargoDetalhe {
  id: number;
  nome: string;
  setor_id: number | null;
  descricao: string | null;
  admin: boolean;
  todas_empresas: boolean;
  /** Seções que o cargo concede, como chaves "modulo/secao". */
  secoes: string[];
  grupos: number[];
}

export async function carregarCargo(id: number): Promise<CargoDetalhe | null> {
  const [c] = await appQuery<{
    id: number;
    nome: string;
    setor_id: number | null;
    descricao: string | null;
    admin: boolean;
    todas_empresas: boolean;
  }>(
    `select id, nome, setor_id, descricao, admin, todas_empresas from cargo where id = $1`,
    [id]
  );
  if (!c) return null;

  const [secoes, grupos] = await Promise.all([
    appQuery<{ modulo: string; secao: string }>(
      `select modulo, secao from cargo_secao where cargo_id = $1`,
      [id]
    ),
    appQuery<{ grupo_id: number }>(`select grupo_id from cargo_grupo where cargo_id = $1`, [id]),
  ]);

  return {
    id: c.id,
    nome: c.nome,
    setor_id: c.setor_id,
    descricao: c.descricao,
    admin: c.admin,
    todas_empresas: c.todas_empresas,
    secoes: secoes.map((s) => `${s.modulo}/${s.secao}`),
    grupos: grupos.map((g) => g.grupo_id),
  };
}

/** Cargos disponíveis para atribuir a um usuário. */
export interface CargoOpcao {
  id: number;
  nome: string;
  setorNome: string | null;
  admin: boolean;
}

export async function listarCargosParaForm(): Promise<CargoOpcao[]> {
  const rows = await appQuery<{
    id: number;
    nome: string;
    setor_nome: string | null;
    admin: boolean;
  }>(
    `select c.id, c.nome, st.nome as setor_nome, c.admin
       from cargo c
       left join setor st on st.id = c.setor_id
      order by st.nome nulls last, c.nome`
  );
  return rows.map((c) => ({ id: c.id, nome: c.nome, setorNome: c.setor_nome, admin: c.admin }));
}

// -------------------------------------------------------------------- Grupos

export interface GrupoResumo {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** Quantas empresas o grupo tem hoje. */
  empresas: number;
  /** Quantas estão marcadas — no modo `exceto`, as que ficam de fora. */
  marcadas: number;
  cargos: number;
  usuarios: number;
}

export async function listarGrupos(): Promise<GrupoResumo[]> {
  const [grupos, uso] = await Promise.all([
    resolverGrupos("empresa_grupo"),
    appQuery<{ id: number; cargos: number; usuarios: number }>(
      `select g.id,
              (select count(*)::int from cargo_grupo cg where cg.grupo_id = g.id) as cargos,
              (select count(distinct uc.usuario_id)::int
                 from cargo_grupo cg2
                 join usuario_cargo uc on uc.cargo_id = cg2.cargo_id
                where cg2.grupo_id = g.id) as usuarios
         from empresa_grupo g`
    ),
  ]);
  const usoPorId = new Map(uso.map((u) => [u.id, u]));
  return grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    modo: g.modo,
    empresas: g.membros.length,
    marcadas: g.marcadas.length,
    cargos: usoPorId.get(g.id)?.cargos ?? 0,
    usuarios: usoPorId.get(g.id)?.usuarios ?? 0,
  }));
}

export interface GrupoDetalhe {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** As marcadas, como estão gravadas (dentro ou fora, conforme o modo). */
  empresas: number[];
}

export async function carregarGrupo(id: number): Promise<GrupoDetalhe | null> {
  const [g] = await appQuery<{ id: number; nome: string; modo: ModoGrupo }>(
    `select id, nome, modo from empresa_grupo where id = $1`,
    [id]
  );
  if (!g) return null;
  const itens = await appQuery<{ codigoempresa: number }>(
    `select codigoempresa from empresa_grupo_item where grupo_id = $1`,
    [id]
  );
  return { ...g, empresas: itens.map((i) => i.codigoempresa) };
}

export interface EmpresaOpcao {
  codigo: number;
  nome: string;
}

/** Todas as empresas do Questor — para o admin escolher o escopo. */
export async function listarTodasEmpresas(): Promise<EmpresaOpcao[]> {
  return query<EmpresaOpcao>(
    `select codigoempresa as codigo, nomeempresa as nome from empresa order by nomeempresa`
  );
}
