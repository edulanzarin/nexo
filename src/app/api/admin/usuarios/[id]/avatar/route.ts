import { apiRoute } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { apagarAvatar, gravarAvatar, lerArquivoAvatar, versaoAvatar } from "@/lib/avatar";
import { FilterError } from "@/lib/fiscal-filters";
import { idUsuarioDaRota } from "@/lib/admin-sessao";

/** A foto de um usuário, trocada pelo administrador. Vai em multipart, campo `avatar`. */
export const POST = apiRoute(async (req, ctx) => {
  const id = await idUsuarioDaRota(ctx);
  const form = await req.formData().catch(() => {
    throw new FilterError("Envie a foto como arquivo");
  });
  await gravarAvatar(id, await lerArquivoAvatar(form));
  await registrarAuditoria({ acao: "admin.usuario.foto", modulo: "admin", alvo: id });
  return { avatarVersao: await versaoAvatar(id) };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  const id = await idUsuarioDaRota(ctx);
  await apagarAvatar(id);
  await registrarAuditoria({ acao: "admin.usuario.foto", modulo: "admin", alvo: id });
  return { avatarVersao: null };
});
