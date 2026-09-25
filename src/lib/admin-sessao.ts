import "server-only";
import { ehUuid } from "./admin";
import { tokenAtual } from "./auth";
import { FilterError } from "./fiscal-filters";
import { getSessaoOpcional } from "./sessao";

/** O segundo argumento do route handler. */
type Ctx = { params: Promise<Record<string, string>> };

/**
 * Quem está administrando: o id (não se exclui nem se desativa) e o token da
 * sessão (a troca de senha derruba as outras sessões, menos esta). O `apiRoute`
 * já exigiu a sessão e o acesso total antes de chegar aqui.
 */
export async function quemAdministra(): Promise<{ id: string; token: string | null }> {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Sessão expirada. Entre de novo.");
  return { id: sessao.usuario.id, token: await tokenAtual() };
}

export async function idUsuarioDaRota(ctx: Ctx): Promise<string> {
  const id = (await ctx.params).id ?? "";
  // A coluna é uuid: id fora do formato viraria erro de banco em vez de recusa.
  if (!ehUuid(id)) throw new FilterError("Usuário inválido");
  return id;
}

export async function idNumericoDaRota(ctx: Ctx, erro: string): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new FilterError(erro);
  return id;
}
