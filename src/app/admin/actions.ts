"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appPool } from "@/lib/app-db";
import { hashSenha } from "@/lib/auth";
import { assertAdmin } from "@/lib/sessao";
import { ehModoGrupo } from "@/lib/grupo-modo";
import { MODULOS, secoesDoModulo } from "@/lib/modulos";

/** Conjunto válido de "modulo/secao" — barra chaves forjadas no form. */
function secoesValidas(): Set<string> {
  const s = new Set<string>();
  for (const m of MODULOS) for (const sec of secoesDoModulo(m.id)) s.add(`${m.id}/${sec.id}`);
  return s;
}

/** Chaves "modulo/secao" marcadas no form (checkbox "sec:<modulo>:<secao>"). */
function lerSecoesMarcadas(formData: FormData): Set<string> {
  const validas = secoesValidas();
  const out = new Set<string>();
  for (const k of formData.keys()) {
    if (!k.startsWith("sec:")) continue;
    const [, modulo, secao] = k.split(":");
    const chave = `${modulo}/${secao}`;
    if (validas.has(chave)) out.add(chave);
  }
  return out;
}

const limpo = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s || null;
};

const idNum = (v: FormDataEntryValue | null): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

type Q = (sql: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

async function comTransacao<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query("begin");
    const r = await fn((sql, p) => client.query(sql, p));
    await client.query("commit");
    return r;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------------ Usuários

export async function salvarUsuario(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const telefone = limpo(formData.get("telefone"));
  const ativo = formData.get("ativo") === "on";
  // Toda a permissão vem dos cargos (união). Sem ajuste por usuário.
  const cargos = formData.getAll("cargos").map((c) => Number(c)).filter(Number.isInteger);

  if (!nome || !email) throw new Error("Nome e email são obrigatórios");
  if (!id && !senha) throw new Error("Defina uma senha para o novo usuário");
  if (cargos.length === 0) throw new Error("Atribua ao menos um cargo");

  // Foto de perfil: arquivo novo (substitui) ou pedido de remoção. Valida tipo e
  // tamanho no servidor — nunca confiar no accept do input.
  const removerFoto = formData.get("remover_foto") === "on";
  const arquivo = formData.get("avatar");
  let avatar: { mime: string; bytes: Buffer } | null = null;
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!arquivo.type.startsWith("image/")) throw new Error("A foto precisa ser uma imagem");
    if (arquivo.size > 2 * 1024 * 1024) throw new Error("A foto deve ter no máximo 2 MB");
    avatar = { mime: arquivo.type, bytes: Buffer.from(await arquivo.arrayBuffer()) };
  }

  const senhaHash = senha ? await hashSenha(senha) : null;

  await comTransacao(async (q) => {
    let usuarioId = id;
    if (id) {
      await q(
        `update usuario set nome = $2, email = $3, telefone = $4, ativo = $5
           ${senhaHash ? ", senha_hash = $6" : ""}
         where id = $1`,
        senhaHash
          ? [id, nome, email, telefone, ativo, senhaHash]
          : [id, nome, email, telefone, ativo]
      );
    } else {
      const { rows } = await q(
        `insert into usuario (nome, email, telefone, senha_hash, ativo)
         values ($1, $2, $3, $4, $5) returning id`,
        [nome, email, telefone, senhaHash, ativo]
      );
      usuarioId = rows[0].id as string;
    }

    // Foto: remoção explícita ou upsert do arquivo novo (mantém a atual se nada
    // veio no form).
    if (removerFoto) {
      await q(`delete from usuario_avatar where usuario_id = $1`, [usuarioId]);
    } else if (avatar) {
      await q(
        `insert into usuario_avatar (usuario_id, mime, bytes, atualizado_em)
         values ($1, $2, $3, now())
         on conflict (usuario_id) do update
           set mime = excluded.mime, bytes = excluded.bytes, atualizado_em = now()`,
        [usuarioId, avatar.mime, avatar.bytes]
      );
    }

    // Cargos: o form é a verdade completa — recria o vínculo do zero.
    await q(`delete from usuario_cargo where usuario_id = $1`, [usuarioId]);
    for (const c of cargos) {
      await q(`insert into usuario_cargo (usuario_id, cargo_id) values ($1, $2)`, [usuarioId, c]);
    }
  });

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function excluirUsuario(formData: FormData): Promise<void> {
  const sessao = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  // Um admin não se exclui sozinho (evita ficar sem nenhum admin por engano).
  if (id && id !== sessao.usuario.id) {
    await appPool.query(`delete from usuario where id = $1`, [id]);
  }
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

// -------------------------------------------------------------------- Cargos

export async function salvarCargo(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = idNum(formData.get("id"));
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Dê um nome ao cargo");
  const setorIdForm = idNum(formData.get("setor_id"));
  const setorNovo = limpo(formData.get("setor_novo"));
  const descricao = limpo(formData.get("descricao"));
  // Acesso total (admin) já implica ver todas as empresas.
  const admin = formData.get("admin") === "on";
  const todasEmpresas = admin || formData.get("todas_empresas") === "on";
  // Seções marcadas = as que o cargo concede.
  const secoes = [...lerSecoesMarcadas(formData)];
  const grupos = formData.getAll("grupos").map((g) => Number(g)).filter(Number.isInteger);

  await comTransacao(async (q) => {
    // Setor digitado que não existe: cria na hora (upsert por nome).
    let setorId = setorIdForm;
    if (setorId == null && setorNovo) {
      const { rows } = await q(
        `insert into setor (nome) values ($1)
         on conflict (nome) do update set nome = excluded.nome returning id`,
        [setorNovo]
      );
      setorId = rows[0].id as number;
    }

    let cargoId = id;
    if (id != null) {
      await q(
        `update cargo set nome = $2, setor_id = $3, descricao = $4, admin = $5, todas_empresas = $6
         where id = $1`,
        [id, nome, setorId, descricao, admin, todasEmpresas]
      );
    } else {
      const { rows } = await q(
        `insert into cargo (nome, setor_id, descricao, admin, todas_empresas)
         values ($1, $2, $3, $4, $5) returning id`,
        [nome, setorId, descricao, admin, todasEmpresas]
      );
      cargoId = rows[0].id as number;
    }
    await q(`delete from cargo_secao where cargo_id = $1`, [cargoId]);
    for (const chave of secoes) {
      const [modulo, secao] = chave.split("/");
      await q(`insert into cargo_secao (cargo_id, modulo, secao) values ($1, $2, $3)`, [
        cargoId,
        modulo,
        secao,
      ]);
    }
    await q(`delete from cargo_grupo where cargo_id = $1`, [cargoId]);
    for (const g of grupos) {
      await q(`insert into cargo_grupo (cargo_id, grupo_id) values ($1, $2)`, [cargoId, g]);
    }
  });

  revalidatePath("/admin/cargos");
  redirect("/admin/cargos");
}

export async function excluirCargo(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = idNum(formData.get("id"));
  // Usuários com este cargo ficam sem cargo (FK on delete set null).
  if (id != null) await appPool.query(`delete from cargo where id = $1`, [id]);
  revalidatePath("/admin/cargos");
  redirect("/admin/cargos");
}

// -------------------------------------------------------------------- Setores

export async function salvarSetor(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = idNum(formData.get("id"));
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Dê um nome ao setor");
  if (id != null) {
    await appPool.query(`update setor set nome = $2 where id = $1`, [id, nome]);
  } else {
    await appPool.query(`insert into setor (nome) values ($1)`, [nome]);
  }
  revalidatePath("/admin/setores");
  redirect("/admin/setores");
}

export async function excluirSetor(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = idNum(formData.get("id"));
  // Cargos do setor ficam sem setor (FK on delete set null).
  if (id != null) await appPool.query(`delete from setor where id = $1`, [id]);
  revalidatePath("/admin/setores");
  redirect("/admin/setores");
}

// -------------------------------------------------------------------- Grupos

export async function salvarGrupo(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = Number(formData.get("id"));
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Dê um nome ao grupo");
  const modo = formData.get("modo");
  if (!ehModoGrupo(modo)) throw new Error("Modo do grupo inválido");
  const empresas = formData.getAll("empresas").map((e) => Number(e)).filter(Number.isInteger);

  await comTransacao(async (q) => {
    let grupoId = id;
    if (Number.isInteger(id) && id > 0) {
      await q(`update empresa_grupo set nome = $2, modo = $3 where id = $1`, [id, nome, modo]);
    } else {
      const { rows } = await q(
        `insert into empresa_grupo (nome, modo) values ($1, $2) returning id`,
        [nome, modo]
      );
      grupoId = rows[0].id as number;
    }
    await q(`delete from empresa_grupo_item where grupo_id = $1`, [grupoId]);
    for (const e of empresas) {
      await q(`insert into empresa_grupo_item (grupo_id, codigoempresa) values ($1, $2)`, [grupoId, e]);
    }
  });

  revalidatePath("/admin/grupos");
  redirect("/admin/grupos");
}

export async function excluirGrupo(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) {
    await appPool.query(`delete from empresa_grupo where id = $1`, [id]);
  }
  revalidatePath("/admin/grupos");
  redirect("/admin/grupos");
}
