import "server-only";
import type { PoolClient } from "pg";
import {
  NOME_MAX,
  SENHA_MIN,
  type CargoDetalhe,
  type CargoResumo,
  type DadosCargo,
  type DadosUsuario,
  type GrupoPermissaoResumo,
  type PaginaTrilha,
  type SetorResumo,
  type UsuarioLista,
} from "./admin-tipos";
import { appPool, appQuery, erroAppDb } from "./app-db";
import { hashSenha } from "./auth";
import { listarAuditoria, registrarAuditoria } from "./auditoria";
import { FilterError } from "./fiscal-filters";
import { resolverGrupos } from "./grupo-membros";
import type { GrupoEmpresaDetalhe, DadosGrupoEmpresa } from "./grupos-empresa-tipos";
import type { ModoGrupo } from "./grupo-modo";
import { MODULOS_CONCEDIVEIS, secoesDoModulo } from "./modulos";

/**
 * A Administração: usuários, cargos, setores, grupos de permissão e a trilha.
 * Tudo no banco do app; as rotas em `/api/admin/*` só abrem para administrador.
 *
 * Três travas que o nexo2 não tinha, porque cada uma deixava o cadastro num
 * estado que ninguém consegue desfazer pela tela:
 * - sempre sobra ao menos um administrador ativo (senão ninguém mais entra aqui);
 * - quem está logado não se exclui nem se desativa;
 * - quem tem relatório do Post Mortem ou rescisão marcada não se exclui (a
 *   chave estrangeira recusava com erro de banco): desativa.
 *
 * Toda escrita entra na trilha de auditoria: mudar permissão é o primeiro
 * gesto que uma investigação pergunta quem fez.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(v: string): boolean {
  return UUID.test(v);
}

type Q = PoolClient["query"];

async function comTransacao<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await appPool.connect();
  } catch (err) {
    throw erroAppDb(err);
  }
  try {
    await client.query("begin");
    const r = await fn(client.query.bind(client) as Q);
    await client.query("commit");
    return r;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Erro do banco vira mensagem de tela quando é violação de nome único. */
function traduzir(err: unknown, unico?: string): never {
  if (err instanceof FilterError) throw err;
  if (unico && (err as { code?: string })?.code === "23505") throw new FilterError(unico);
  throw erroAppDb(err);
}

/**
 * Depois de mexer em usuário ou cargo, dentro da transação: sobrou alguém que
 * entra na Administração? Sem ninguém, a mudança volta.
 */
async function exigirAdminAtivo(q: Q): Promise<void> {
  const { rows } = await q(
    `select exists (
       select 1 from usuario u
         join usuario_cargo uc on uc.usuario_id = u.id
         join cargo c on c.id = uc.cargo_id
        where u.ativo and c.admin
     ) as ok`
  );
  if (!rows[0]?.ok)
    throw new FilterError("Ninguém mais ficaria com acesso total. Mantenha ao menos um administrador ativo.");
}

const texto = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const opcional = (v: unknown): string | null => texto(v) || null;
const ids = (v: unknown, erro: string): number[] => {
  if (v == null) return [];
  if (!Array.isArray(v) || !v.every((n) => Number.isInteger(n) && n > 0)) throw new FilterError(erro);
  return [...new Set(v as number[])];
};

// ── Usuários ─────────────────────────────────────────────────────────────────

export async function listarUsuarios(): Promise<UsuarioLista[]> {
  const rows = await appQuery<{
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
    ativo: boolean;
    cargos: { id: number; nome: string; admin: boolean }[];
    admin: boolean;
    todas_empresas: boolean;
    ultimo_acesso: string | null;
    avatar_versao: string | null;
    registros: number;
  }>(
    `select u.id, u.nome, u.email::text as email, u.telefone, u.ativo,
            coalesce(json_agg(json_build_object('id', c.id, 'nome', c.nome, 'admin', c.admin) order by c.nome)
                       filter (where c.id is not null), '[]') as cargos,
            coalesce(bool_or(c.admin), false) as admin,
            coalesce(bool_or(c.todas_empresas), false) as todas_empresas,
            to_char(u.ultimo_acesso, 'YYYY-MM-DD"T"HH24:MI:SS') as ultimo_acesso,
            extract(epoch from av.atualizado_em) * 1000 as avatar_versao,
            (select count(*)::int from postmortem p where p.autor_id = u.id)
              + (select count(*)::int from rescisao_resolvida r where r.marcado_por = u.id) as registros
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
    telefone: r.telefone,
    ativo: r.ativo,
    cargos: r.cargos,
    admin: r.admin,
    todasEmpresas: r.admin || r.todas_empresas,
    ultimoAcesso: r.ultimo_acesso,
    avatarVersao: r.avatar_versao != null ? Math.round(Number(r.avatar_versao)) : null,
    registros: r.registros,
  }));
}

/** O corpo que a tela manda, conferido. Senha só é exigida ao criar. */
export function lerDadosUsuario(corpo: unknown, criando: boolean): DadosUsuario {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(b.nome);
  if (!nome) throw new FilterError("Informe o nome");
  if (nome.length > NOME_MAX) throw new FilterError(`O nome passa de ${NOME_MAX} letras`);
  const email = texto(b.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FilterError("Informe um e-mail válido");
  const telefone = opcional(b.telefone);
  if (telefone && telefone.length > 30) throw new FilterError("Telefone longo demais");
  const senha = typeof b.senha === "string" ? b.senha : "";
  if (criando && !senha) throw new FilterError("Defina uma senha para o novo usuário");
  if (senha && senha.length < SENHA_MIN) throw new FilterError(`A senha precisa de ao menos ${SENHA_MIN} caracteres`);
  if (typeof b.ativo !== "boolean") throw new FilterError("Situação do usuário inválida");
  const cargos = ids(b.cargos, "Lista de cargos inválida");
  if (!cargos.length) throw new FilterError("Atribua ao menos um cargo");
  return { nome, email, telefone, senha, ativo: b.ativo, cargos };
}

const emailEmUso = "Já existe um usuário com este e-mail";

/**
 * Cria (sem `id`) ou salva um usuário. Os cargos da tela são a lista inteira.
 * Senha nova derruba as outras sessões da pessoa: é o que o administrador quer
 * quando troca a senha de alguém.
 */
export async function salvarUsuario(
  dados: DadosUsuario,
  quem: { id: string; token: string | null },
  id?: string
): Promise<string> {
  if (id === quem.id && !dados.ativo) throw new FilterError("Você não pode desativar o próprio usuário");
  const senhaHash = dados.senha ? await hashSenha(dados.senha) : null;
  let usuarioId: string;
  try {
    usuarioId = await comTransacao(async (q) => {
      const { rows: existentes } = await q(`select id from cargo where id = any($1::int[])`, [dados.cargos]);
      if (existentes.length !== dados.cargos.length)
        throw new FilterError("Um dos cargos não existe mais. Recarregue a página.");

      let uid: string;
      if (id) {
        const { rowCount } = await q(
          `update usuario set nome = $2, email = $3, telefone = $4, ativo = $5
                              ${senhaHash ? ", senha_hash = $6" : ""}
            where id = $1`,
          senhaHash
            ? [id, dados.nome, dados.email, dados.telefone, dados.ativo, senhaHash]
            : [id, dados.nome, dados.email, dados.telefone, dados.ativo]
        );
        if (!rowCount) throw new FilterError("O usuário não existe mais. Alguém pode ter removido.");
        uid = id;
      } else {
        const { rows } = await q(
          `insert into usuario (nome, email, telefone, senha_hash, ativo)
           values ($1, $2, $3, $4, $5) returning id`,
          [dados.nome, dados.email, dados.telefone, senhaHash, dados.ativo]
        );
        uid = rows[0].id as string;
      }
      await q(`delete from usuario_cargo where usuario_id = $1`, [uid]);
      await q(`insert into usuario_cargo (usuario_id, cargo_id) select $1, unnest($2::int[])`, [uid, dados.cargos]);
      if (senhaHash && id) await q(`delete from sessao where usuario_id = $1 and token is distinct from $2`, [uid, quem.token]);
      await exigirAdminAtivo(q);
      return uid;
    });
  } catch (err) {
    traduzir(err, emailEmUso);
  }
  await registrarAuditoria({
    acao: id ? "admin.usuario.salvar" : "admin.usuario.criar",
    modulo: "admin",
    alvo: `${dados.nome} (${dados.email})`,
  });
  return usuarioId;
}

export async function excluirUsuario(id: string, quemId: string): Promise<void> {
  if (id === quemId) throw new FilterError("Você não pode excluir o próprio usuário");
  let nome = "";
  try {
    await comTransacao(async (q) => {
      const { rows } = await q(
        `select u.nome,
                (select count(*)::int from postmortem p where p.autor_id = u.id) as relatorios,
                (select count(*)::int from rescisao_resolvida r where r.marcado_por = u.id) as rescisoes
           from usuario u where u.id = $1`,
        [id]
      );
      if (!rows[0]) throw new FilterError("O usuário não existe mais. Alguém pode ter removido.");
      const { relatorios, rescisoes } = rows[0] as { nome: string; relatorios: number; rescisoes: number };
      nome = rows[0].nome as string;
      if (relatorios || rescisoes) {
        const partes = [
          relatorios ? `${relatorios === 1 ? "um relatório" : `${relatorios} relatórios`} do Post Mortem` : "",
          rescisoes ? `${rescisoes === 1 ? "uma rescisão marcada" : `${rescisoes} rescisões marcadas`} como paga` : "",
        ].filter(Boolean);
        throw new FilterError(
          `${nome} tem ${partes.join(" e ")}, e o registro guarda quem fez. Desative o usuário para tirar o acesso.`
        );
      }
      await q(`delete from usuario where id = $1`, [id]);
      await exigirAdminAtivo(q);
    });
  } catch (err) {
    traduzir(err);
  }
  await registrarAuditoria({ acao: "admin.usuario.excluir", modulo: "admin", alvo: nome });
}

// ── Cargos ───────────────────────────────────────────────────────────────────

export async function listarCargos(): Promise<CargoResumo[]> {
  const rows = await appQuery<{
    id: number;
    nome: string;
    setor_id: number | null;
    setor_nome: string | null;
    descricao: string | null;
    admin: boolean;
    todas_empresas: boolean;
    secoes: number;
    grupos: number;
    usuarios: number;
  }>(
    `select c.id, c.nome, c.setor_id, st.nome as setor_nome, c.descricao, c.admin, c.todas_empresas,
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
    setorId: r.setor_id,
    setorNome: r.setor_nome,
    descricao: r.descricao,
    admin: r.admin,
    todasEmpresas: r.admin || r.todas_empresas,
    secoes: r.secoes,
    grupos: r.grupos,
    usuarios: r.usuarios,
  }));
}

export async function carregarCargo(id: number): Promise<CargoDetalhe | null> {
  const [c] = await appQuery<{
    id: number;
    nome: string;
    setor_id: number | null;
    descricao: string | null;
    admin: boolean;
    todas_empresas: boolean;
    usuarios: number;
  }>(
    `select c.id, c.nome, c.setor_id, c.descricao, c.admin, c.todas_empresas,
            (select count(*)::int from usuario_cargo uc where uc.cargo_id = c.id) as usuarios
       from cargo c where c.id = $1`,
    [id]
  );
  if (!c) return null;
  const [secoes, grupos] = await Promise.all([
    appQuery<{ modulo: string; secao: string }>(`select modulo, secao from cargo_secao where cargo_id = $1`, [id]),
    appQuery<{ grupo_id: number }>(`select grupo_id from cargo_grupo where cargo_id = $1`, [id]),
  ]);
  return {
    id: c.id,
    nome: c.nome,
    setorId: c.setor_id,
    descricao: c.descricao,
    admin: c.admin,
    todasEmpresas: c.todas_empresas,
    secoes: secoes.map((s) => `${s.modulo}/${s.secao}`),
    grupos: grupos.map((g) => g.grupo_id),
    usuarios: c.usuarios,
  };
}

/** As chaves "modulo/secao" que um cargo pode liberar. A Administração fica fora. */
function secoesConcediveis(): Set<string> {
  const s = new Set<string>();
  for (const m of MODULOS_CONCEDIVEIS) for (const sec of secoesDoModulo(m.id)) s.add(`${m.id}/${sec.id}`);
  return s;
}

export function lerDadosCargo(corpo: unknown): DadosCargo {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(b.nome);
  if (!nome) throw new FilterError("Dê um nome ao cargo");
  if (nome.length > NOME_MAX) throw new FilterError(`O nome passa de ${NOME_MAX} letras`);
  const setorId = b.setorId == null ? null : Number(b.setorId);
  if (setorId != null && (!Number.isInteger(setorId) || setorId <= 0)) throw new FilterError("Setor inválido");
  const setorNovo = setorId == null ? opcional(b.setorNovo) : null;
  if (setorNovo && setorNovo.length > NOME_MAX) throw new FilterError(`O nome do setor passa de ${NOME_MAX} letras`);
  const descricao = opcional(b.descricao);
  if (descricao && descricao.length > 300) throw new FilterError("A descrição passa de 300 letras");
  if (typeof b.admin !== "boolean" || typeof b.todasEmpresas !== "boolean")
    throw new FilterError("Acesso do cargo inválido");
  const admin = b.admin;
  // Acesso total já implica ver todas as empresas.
  const todasEmpresas = admin || b.todasEmpresas;
  if (!Array.isArray(b.secoes) || !b.secoes.every((s) => typeof s === "string"))
    throw new FilterError("Lista de seções inválida");
  // Chave que não existe (forjada, ou de uma seção que saiu do catálogo) não entra.
  const validas = secoesConcediveis();
  const secoes = admin ? [] : [...new Set(b.secoes as string[])].filter((s) => validas.has(s));
  const grupos = admin ? [] : ids(b.grupos, "Lista de grupos inválida");
  return { nome, setorId, setorNovo, descricao, admin, todasEmpresas, secoes, grupos };
}

/** Cria (sem `id`) ou salva um cargo inteiro. Setor digitado que não existe nasce aqui. */
export async function salvarCargo(dados: DadosCargo, id?: number): Promise<number> {
  let cargoId: number;
  try {
    cargoId = await comTransacao(async (q) => {
      let setorId = dados.setorId;
      if (setorId == null && dados.setorNovo) {
        // O índice único do setor diferencia maiúscula; "contábil" não pode
        // virar um segundo Contábil.
        const { rows: igual } = await q(`select id from setor where lower(nome) = lower($1) limit 1`, [dados.setorNovo]);
        setorId = igual[0]
          ? (igual[0].id as number)
          : ((await q(`insert into setor (nome) values ($1) returning id`, [dados.setorNovo])).rows[0].id as number);
      }
      const { rows: mesmoNome } = await q(`select 1 from cargo where lower(nome) = lower($1) and id <> $2 limit 1`, [
        dados.nome,
        id ?? 0,
      ]);
      if (mesmoNome.length) throw new FilterError(`Já existe um cargo chamado ${dados.nome}`);

      let cid: number;
      if (id != null) {
        const { rowCount } = await q(
          `update cargo set nome = $2, setor_id = $3, descricao = $4, admin = $5, todas_empresas = $6 where id = $1`,
          [id, dados.nome, setorId, dados.descricao, dados.admin, dados.todasEmpresas]
        );
        if (!rowCount) throw new FilterError("O cargo não existe mais. Alguém pode ter removido.");
        cid = id;
      } else {
        const { rows } = await q(
          `insert into cargo (nome, setor_id, descricao, admin, todas_empresas)
           values ($1, $2, $3, $4, $5) returning id`,
          [dados.nome, setorId, dados.descricao, dados.admin, dados.todasEmpresas]
        );
        cid = rows[0].id as number;
      }
      await q(`delete from cargo_secao where cargo_id = $1`, [cid]);
      if (dados.secoes.length)
        await q(
          `insert into cargo_secao (cargo_id, modulo, secao)
           select $1, split_part(k, '/', 1), split_part(k, '/', 2) from unnest($2::text[]) k`,
          [cid, dados.secoes]
        );
      await q(`delete from cargo_grupo where cargo_id = $1`, [cid]);
      if (dados.grupos.length) {
        const { rows: existentes } = await q(`select id from empresa_grupo where id = any($1::int[])`, [dados.grupos]);
        if (existentes.length !== dados.grupos.length)
          throw new FilterError("Um dos grupos de permissão não existe mais. Recarregue a página.");
        await q(`insert into cargo_grupo (cargo_id, grupo_id) select $1, unnest($2::int[])`, [cid, dados.grupos]);
      }
      await exigirAdminAtivo(q);
      return cid;
    });
  } catch (err) {
    traduzir(err, `Já existe um cargo chamado ${dados.nome}`);
  }
  await registrarAuditoria({ acao: id != null ? "admin.cargo.salvar" : "admin.cargo.criar", modulo: "admin", alvo: dados.nome });
  return cargoId;
}

/** Remove o cargo. Quem o tinha perde o acesso que vinha dele. */
export async function excluirCargo(id: number): Promise<void> {
  let nome = "";
  try {
    await comTransacao(async (q) => {
      const { rows } = await q(`delete from cargo where id = $1 returning nome`, [id]);
      if (!rows[0]) throw new FilterError("O cargo não existe mais. Alguém pode ter removido.");
      nome = rows[0].nome as string;
      await exigirAdminAtivo(q);
    });
  } catch (err) {
    traduzir(err);
  }
  await registrarAuditoria({ acao: "admin.cargo.excluir", modulo: "admin", alvo: nome });
}

// ── Setores ──────────────────────────────────────────────────────────────────

export async function listarSetores(): Promise<SetorResumo[]> {
  return appQuery<SetorResumo>(
    `select s.id, s.nome, count(c.id)::int as cargos
       from setor s
       left join cargo c on c.setor_id = s.id
      group by s.id
      order by s.nome`
  );
}

export function lerNomeSetor(corpo: unknown): string {
  const nome = texto((corpo as { nome?: unknown } | null)?.nome);
  if (!nome) throw new FilterError("Dê um nome ao setor");
  if (nome.length > NOME_MAX) throw new FilterError(`O nome passa de ${NOME_MAX} letras`);
  return nome;
}

export async function salvarSetor(nome: string, id?: number): Promise<number> {
  const emUso = `Já existe um setor chamado ${nome}`;
  let setorId: number;
  try {
    const [igual] = await appQuery(`select 1 from setor where lower(nome) = lower($1) and id <> $2 limit 1`, [nome, id ?? 0]);
    if (igual) throw new FilterError(emUso);
    if (id != null) {
      const r = await appQuery<{ id: number }>(`update setor set nome = $2 where id = $1 returning id`, [id, nome]);
      if (!r[0]) throw new FilterError("O setor não existe mais. Alguém pode ter removido.");
      setorId = id;
    } else {
      setorId = (await appQuery<{ id: number }>(`insert into setor (nome) values ($1) returning id`, [nome]))[0].id;
    }
  } catch (err) {
    traduzir(err, emUso);
  }
  await registrarAuditoria({ acao: id != null ? "admin.setor.salvar" : "admin.setor.criar", modulo: "admin", alvo: nome });
  return setorId;
}

/** Remove o setor. Os cargos dele ficam sem setor (a chave estrangeira anula). */
export async function excluirSetor(id: number): Promise<void> {
  const r = await appQuery<{ nome: string }>(`delete from setor where id = $1 returning nome`, [id]);
  if (!r[0]) throw new FilterError("O setor não existe mais. Alguém pode ter removido.");
  await registrarAuditoria({ acao: "admin.setor.excluir", modulo: "admin", alvo: r[0].nome });
}

// ── Grupos de permissão ──────────────────────────────────────────────────────

export async function listarGruposPermissao(): Promise<GrupoPermissaoResumo[]> {
  const [grupos, uso] = await Promise.all([
    resolverGrupos("empresa_grupo"),
    appQuery<{ id: number; cargos: number; usuarios: number; atualizado_em: string }>(
      `select g.id,
              to_char(g.atualizado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as atualizado_em,
              (select count(*)::int from cargo_grupo cg where cg.grupo_id = g.id) as cargos,
              (select count(distinct uc.usuario_id)::int
                 from cargo_grupo cg2
                 join usuario_cargo uc on uc.cargo_id = cg2.cargo_id
                where cg2.grupo_id = g.id) as usuarios
         from empresa_grupo g`
    ),
  ]);
  const porId = new Map(uso.map((u) => [u.id, u]));
  return grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    modo: g.modo,
    empresas: g.membros.length,
    marcadas: g.marcadas.length,
    cargos: porId.get(g.id)?.cargos ?? 0,
    usuarios: porId.get(g.id)?.usuarios ?? 0,
    atualizadoEm: porId.get(g.id)?.atualizado_em ?? "",
  }));
}

export async function carregarGrupoPermissao(id: number): Promise<GrupoEmpresaDetalhe | null> {
  const [g] = await appQuery<{ id: number; nome: string; modo: ModoGrupo }>(
    `select id, nome, modo from empresa_grupo where id = $1`,
    [id]
  );
  if (!g) return null;
  const itens = await appQuery<{ codigoempresa: number }>(
    `select codigoempresa from empresa_grupo_item where grupo_id = $1 order by codigoempresa`,
    [id]
  );
  return { ...g, empresas: itens.map((i) => i.codigoempresa) };
}

/** Cria (sem `id`) ou substitui um grupo inteiro. O corpo é conferido por `lerDadosGrupo`. */
export async function salvarGrupoPermissao(dados: DadosGrupoEmpresa, id?: number): Promise<number> {
  const emUso = `Já existe um grupo chamado ${dados.nome}`;
  const empresas = [...new Set(dados.empresas)];
  let grupoId: number;
  try {
    grupoId = await comTransacao(async (q) => {
      const { rows: iguais } = await q(`select 1 from empresa_grupo where lower(nome) = lower($1) and id <> $2 limit 1`, [
        dados.nome,
        id ?? 0,
      ]);
      if (iguais.length) throw new FilterError(emUso);
      let gid: number;
      if (id != null) {
        const { rowCount } = await q(`update empresa_grupo set nome = $2, modo = $3 where id = $1`, [id, dados.nome, dados.modo]);
        if (!rowCount) throw new FilterError("O grupo não existe mais. Alguém pode ter removido.");
        gid = id;
      } else {
        const { rows } = await q(`insert into empresa_grupo (nome, modo) values ($1, $2) returning id`, [dados.nome, dados.modo]);
        gid = rows[0].id as number;
      }
      // Um insert só: um grupo "todas, exceto" montado em lista passa de mil linhas.
      await q(`delete from empresa_grupo_item where grupo_id = $1`, [gid]);
      if (empresas.length)
        await q(`insert into empresa_grupo_item (grupo_id, codigoempresa) select $1, unnest($2::int[])`, [gid, empresas]);
      return gid;
    });
  } catch (err) {
    traduzir(err, emUso);
  }
  await registrarAuditoria({ acao: id != null ? "admin.grupo.salvar" : "admin.grupo.criar", modulo: "admin", alvo: dados.nome });
  return grupoId;
}

/** Remove o grupo. Os cargos que o traziam deixam de enxergar essas empresas. */
export async function excluirGrupoPermissao(id: number): Promise<void> {
  const r = await appQuery<{ nome: string }>(`delete from empresa_grupo where id = $1 returning nome`, [id]);
  if (!r[0]) throw new FilterError("O grupo não existe mais. Alguém pode ter removido.");
  await registrarAuditoria({ acao: "admin.grupo.excluir", modulo: "admin", alvo: r[0].nome });
}

// ── Auditoria ────────────────────────────────────────────────────────────────

export const TRILHA_POR_PAGINA = 100;

export async function listarTrilha(f: { modulo?: string; busca?: string; pagina: number }): Promise<PaginaTrilha> {
  const { linhas, total } = await listarAuditoria({
    modulo: f.modulo,
    busca: f.busca,
    limite: TRILHA_POR_PAGINA,
    offset: (f.pagina - 1) * TRILHA_POR_PAGINA,
  });
  return {
    linhas: linhas.map((l) => ({
      id: Number(l.id),
      usuarioNome: l.usuario_nome,
      acao: l.acao,
      modulo: l.modulo,
      alvo: l.alvo,
      codigoempresa: l.codigoempresa,
      criadoEm: l.criado_em,
    })),
    total,
    pagina: f.pagina,
    porPagina: TRILHA_POR_PAGINA,
  };
}
