import "server-only";
import { appQuery } from "./app-db";
import { AVATAR_MAX_BYTES, AVATAR_TIPOS } from "./admin-tipos";
import { FilterError } from "./fiscal-filters";

/**
 * A foto de perfil, gravada no banco do app (`usuario_avatar`) e servida por
 * `/api/avatar/<id>`. Quem troca é o administrador (no cadastro do usuário) e a
 * própria pessoa (no perfil); as duas rotas passam por aqui.
 */

export interface ArquivoAvatar {
  mime: string;
  bytes: Buffer;
}

/**
 * O arquivo do formulário, conferido no servidor: o `accept` do input é só
 * sugestão ao navegador. SVG fica de fora de propósito: é código, e a rota da
 * foto serve o arquivo com o tipo que ele declarou.
 */
export async function lerArquivoAvatar(form: FormData): Promise<ArquivoAvatar> {
  const arquivo = form.get("avatar");
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new FilterError("Escolha uma imagem");
  if (!AVATAR_TIPOS.includes(arquivo.type)) throw new FilterError("A foto precisa ser PNG, JPG, WebP ou GIF");
  if (arquivo.size > AVATAR_MAX_BYTES) throw new FilterError("A foto passa de 2 MB");
  return { mime: arquivo.type, bytes: Buffer.from(await arquivo.arrayBuffer()) };
}

export async function gravarAvatar(usuarioId: string, a: ArquivoAvatar): Promise<void> {
  await appQuery(
    `insert into usuario_avatar (usuario_id, mime, bytes, atualizado_em)
     values ($1, $2, $3, now())
     on conflict (usuario_id) do update
       set mime = excluded.mime, bytes = excluded.bytes, atualizado_em = now()`,
    [usuarioId, a.mime, a.bytes]
  );
}

export async function apagarAvatar(usuarioId: string): Promise<void> {
  await appQuery(`delete from usuario_avatar where usuario_id = $1`, [usuarioId]);
}

/** Momento da foto em ms (para renovar o cache da imagem), ou null sem foto. */
export async function versaoAvatar(usuarioId: string): Promise<number | null> {
  const [r] = await appQuery<{ v: string | null }>(
    `select extract(epoch from atualizado_em) * 1000 as v from usuario_avatar where usuario_id = $1`,
    [usuarioId]
  );
  return r?.v != null ? Math.round(Number(r.v)) : null;
}
