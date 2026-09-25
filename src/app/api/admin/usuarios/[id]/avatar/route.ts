import { apiRoute } from "@/lib/api-route";
import { idUsuarioDaRota } from "@/lib/admin-sessao";
import { appQuery } from "@/lib/app-db";
import { registrarAuditoria } from "@/lib/auditoria";
import { apagarAvatar, gravarAvatar, lerArquivoAvatar, versaoAvatar } from "@/lib/avatar";
import { FilterError } from "@/lib/fiscal-filters";

type Ctx = { params: Promise<Record<string, string>> };

/** Quem é a pessoa, para a trilha dizer de quem era a foto (e não o id). */
async function usuarioDaRota(ctx: Ctx): Promise<{ id: string; nome: string }> {
  const id = await idUsuarioDaRota(ctx);
  const [u] = await appQuery<{ nome: string }>(`select nome from usuario where id = $1`, [id]);
  if (!u) throw new FilterError("O usuário não existe mais. Alguém pode ter removido.");
  return { id, nome: u.nome };
}

/** A foto de um usuário, trocada pelo administrador. Vai em multipart, campo `avatar`. */
export const POST = apiRoute(async (req, ctx) => {
  const u = await usuarioDaRota(ctx);
  const form = await req.formData().catch(() => {
    throw new FilterError("Envie a foto como arquivo");
  });
  await gravarAvatar(u.id, await lerArquivoAvatar(form));
  await registrarAuditoria({ acao: "admin.usuario.foto", modulo: "admin", alvo: u.nome });
  return { avatarVersao: await versaoAvatar(u.id) };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  const u = await usuarioDaRota(ctx);
  await apagarAvatar(u.id);
  await registrarAuditoria({ acao: "admin.usuario.foto", modulo: "admin", alvo: u.nome });
  return { avatarVersao: null };
});
