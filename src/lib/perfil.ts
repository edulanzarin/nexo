import "server-only";
import { SENHA_MIN, type Perfil } from "./admin-tipos";
import { appQuery } from "./app-db";
import { contarSessoes, encerrarOutrasSessoes, hashSenha, tokenAtual, verificarSenha } from "./auth";
import { versaoAvatar } from "./avatar";
import { FilterError } from "./fiscal-filters";
import type { Sessao } from "./sessao";

/**
 * O perfil da própria pessoa: a foto, a senha e as sessões abertas. O alvo é
 * sempre o usuário da sessão, nunca um id vindo da tela. Nome, e-mail e cargos
 * são do administrador.
 */

export async function carregarPerfil(sessao: Sessao): Promise<Perfil> {
  const id = sessao.usuario.id;
  const [avatarVersao, sessoes] = await Promise.all([versaoAvatar(id), contarSessoes(id)]);
  return { id, nome: sessao.usuario.nome, email: sessao.usuario.email, avatarVersao, sessoes };
}

/**
 * Troca a senha. Exige a atual: um cookie roubado não vira troca de senha. A
 * troca derruba as outras sessões; só esta, que provou saber a senha, fica.
 * Devolve quantas sessões caíram.
 */
export async function trocarSenha(sessao: Sessao, corpo: unknown): Promise<number> {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const atual = typeof b.atual === "string" ? b.atual : "";
  const nova = typeof b.nova === "string" ? b.nova : "";
  const confirma = typeof b.confirma === "string" ? b.confirma : "";
  if (!atual) throw new FilterError("Informe a senha atual");
  if (nova.length < SENHA_MIN) throw new FilterError(`A nova senha precisa de ao menos ${SENHA_MIN} caracteres`);
  if (nova !== confirma) throw new FilterError("A confirmação não bate com a nova senha");
  if (nova === atual) throw new FilterError("A nova senha é igual à atual");

  const id = sessao.usuario.id;
  const [row] = await appQuery<{ senha_hash: string }>(`select senha_hash from usuario where id = $1`, [id]);
  if (!row || !(await verificarSenha(atual, row.senha_hash))) throw new FilterError("Senha atual incorreta");
  await appQuery(`update usuario set senha_hash = $2 where id = $1`, [id, await hashSenha(nova)]);
  return encerrarOutrasSessoes(id, await tokenAtual());
}

export async function encerrarOutras(sessao: Sessao): Promise<number> {
  return encerrarOutrasSessoes(sessao.usuario.id, await tokenAtual());
}
