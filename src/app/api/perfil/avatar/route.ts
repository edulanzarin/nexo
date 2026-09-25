import { apiRoute } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { apagarAvatar, gravarAvatar, lerArquivoAvatar, versaoAvatar } from "@/lib/avatar";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessao } from "@/lib/sessao";

/** A própria foto. Vai em multipart, campo `avatar`. */
export const POST = apiRoute(async (req) => {
  const { usuario } = await getSessao();
  const form = await req.formData().catch(() => {
    throw new FilterError("Envie a foto como arquivo");
  });
  await gravarAvatar(usuario.id, await lerArquivoAvatar(form));
  await registrarAuditoria({ acao: "perfil.foto", modulo: "perfil" });
  return { avatarVersao: await versaoAvatar(usuario.id) };
});

export const DELETE = apiRoute(async () => {
  await apagarAvatar((await getSessao()).usuario.id);
  await registrarAuditoria({ acao: "perfil.foto", modulo: "perfil" });
  return { avatarVersao: null };
});
