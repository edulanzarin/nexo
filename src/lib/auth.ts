import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { appQuery } from "./app-db";
import { COOKIE_SESSAO } from "./cookie-nome";
import { envInt } from "./env";

/**
 * Autenticação do Hub: hash de senha e ciclo de vida da sessão. Sem dependência
 * externa — `scrypt` do Node basta e o cookie carrega só um token opaco; quem
 * guarda a verdade (validade, dono) é a tabela `sessao` no banco do app.
 *
 * A permissão em si mora em [[sessao]]; aqui é só "quem é" e "está logado".
 */

// promisify não captura o overload com `options`; tipamos o wrapper à mão.
const scrypt = promisify(scryptCb) as (
  senha: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions
) => Promise<Buffer>;

export const COOKIE = COOKIE_SESSAO;
/** Vida da sessão (dias). Cookie roubado morre junto com a linha ao expirar. */
const DIAS_SESSAO = envInt("SESSAO_DIAS", 30);
const KEYLEN = 64;
const SCRYPT_N = 16384; // custo (2^14) — padrão seguro e rápido o bastante no login

/**
 * Hash no formato PHC `scrypt$N$salt_hex$hash_hex`. Guardar o N junto deixa o
 * custo evoluir sem quebrar hashes antigos.
 */
export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(senha, salt, KEYLEN, { N: SCRYPT_N })) as Buffer;
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Comparação em tempo constante — não vaza o acerto pelo tempo de resposta. */
export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split("$");
  if (partes.length !== 4 || partes[0] !== "scrypt") return false;
  const n = Number(partes[1]);
  const salt = Buffer.from(partes[2], "hex");
  const esperado = Buffer.from(partes[3], "hex");
  if (!Number.isInteger(n) || salt.length === 0 || esperado.length === 0) return false;
  const calculado = (await scrypt(senha, salt, esperado.length, { N: n })) as Buffer;
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/**
 * Cria a sessão: grava a linha e seta o cookie httpOnly. Chamável só de Server
 * Action / Route Handler (só lá dá pra escrever cookie). Retorna o token.
 */
export async function criarSessao(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + DIAS_SESSAO * 86_400_000);
  await appQuery(
    `insert into sessao (token, usuario_id, expira_em) values ($1, $2, $3)`,
    [token, usuarioId, expira]
  );
  // Marca o acesso — alimenta a coluna "último acesso" da lista de usuários.
  await appQuery(`update usuario set ultimo_acesso = now() where id = $1`, [usuarioId]);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    // `Secure` só quando o Hub é servido por HTTPS. Na LAN interna ele atende
    // por HTTP puro (ex.: http://ip:4022), e um cookie Secure seria descartado
    // pelo navegador fora de localhost — a sessão sumiria e o login ciclaria.
    // Ligar via COOKIE_SECURE=true quando houver TLS na frente.
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires: expira,
  });
  return token;
}

/** Encerra a sessão atual: apaga a linha e limpa o cookie. */
export async function destruirSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await appQuery(`delete from sessao where token = $1`, [token]);
    jar.delete(COOKIE);
  }
}

/** Token da sessão do request (o cookie opaco), ou null. */
export async function tokenAtual(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/** Quantas sessões ativas (não expiradas) o usuário tem — para o perfil. */
export async function contarSessoes(usuarioId: string): Promise<number> {
  const [r] = await appQuery<{ n: number }>(
    `select count(*)::int as n from sessao where usuario_id = $1 and expira_em > now()`,
    [usuarioId]
  );
  return r?.n ?? 0;
}

/**
 * Encerra TODAS as outras sessões do usuário, mantendo só a atual (`exceto`).
 * Um cookie roubado morre aqui. Retorna quantas linhas foram apagadas.
 */
export async function encerrarOutrasSessoes(usuarioId: string, exceto: string | null): Promise<number> {
  const linhas = await appQuery<{ token: string }>(
    `delete from sessao where usuario_id = $1 and token is distinct from $2 returning token`,
    [usuarioId, exceto]
  );
  return linhas.length;
}
