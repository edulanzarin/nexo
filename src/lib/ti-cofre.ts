import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * A cifra do cofre de Acessos da TI: AES-256-GCM, com a chave fora do banco
 * (TI_COFRE_CHAVE no .env). Sem banco nem sessão, para caber num teste.
 *
 * Cada segredo sai como `v1.<id da chave>.<iv>.<tag>.<cifra>`:
 * - o id da chave (8 letras do sha256 dela) deixa dizer "esta senha foi
 *   guardada com outra chave" em vez de um erro de decifragem sem explicação;
 * - o contexto (acesso e campo) entra como dado autenticado: a cifra da senha
 *   do Wi-Fi copiada no banco para a linha do roteador não abre lá.
 */

export class ErroCofre extends Error {}

const VERSAO = "v1";

/**
 * A chave do ambiente, em base64 (44 letras) ou hexadecimal (64). Vazia é cofre
 * sem chave (`null`); chave do tamanho errado é erro, e não uma chave fraca
 * aceita em silêncio.
 */
export function lerChave(bruta: string | undefined): Buffer | null {
  const t = bruta?.trim();
  if (!t) return null;
  const chave = /^[0-9a-f]{64}$/i.test(t) ? Buffer.from(t, "hex") : Buffer.from(t, "base64");
  if (chave.length !== 32)
    throw new ErroCofre("A TI_COFRE_CHAVE do .env precisa ter 32 bytes: 44 letras em base64 ou 64 em hexadecimal");
  return chave;
}

export const idDaChave = (chave: Buffer) => createHash("sha256").update(chave).digest("hex").slice(0, 8);

/** O id da chave com que o segredo foi guardado. */
export const chaveDaCifra = (cifra: string) => cifra.split(".")[1] ?? "";

/** O contexto de um segredo: qual acesso e qual campo. */
export const contextoSegredo = (acessoId: number, campo: string) => `ti_acesso:${acessoId}:${campo}`;

export function cifrar(texto: string, chave: Buffer, contexto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave, iv, { authTagLength: 16 });
  c.setAAD(Buffer.from(contexto, "utf8"));
  const cifra = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [VERSAO, idDaChave(chave), iv.toString("base64url"), c.getAuthTag().toString("base64url"), cifra.toString("base64url")].join(".");
}

export function decifrar(guardado: string, chave: Buffer, contexto: string): string {
  const [versao, id, iv, tag, cifra] = guardado.split(".");
  if (versao !== VERSAO || !iv || !tag || cifra === undefined) throw new ErroCofre("Segredo em formato desconhecido");
  if (id !== idDaChave(chave))
    throw new ErroCofre("Este segredo foi guardado com outra chave do cofre e não abre com a de agora");
  const d = createDecipheriv("aes-256-gcm", chave, Buffer.from(iv, "base64url"), { authTagLength: 16 });
  d.setAAD(Buffer.from(contexto, "utf8"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  try {
    return Buffer.concat([d.update(Buffer.from(cifra, "base64url")), d.final()]).toString("utf8");
  } catch {
    throw new ErroCofre("O segredo não confere: foi alterado direto no banco ou está corrompido");
  }
}
