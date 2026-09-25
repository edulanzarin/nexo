import { apiRoute } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { trocarSenha } from "@/lib/perfil";
import { getSessao } from "@/lib/sessao";

/** Troca a própria senha (com a atual) e derruba as outras sessões. */
export const POST = apiRoute(async (req) => {
  const encerradas = await trocarSenha(await getSessao(), await req.json().catch(() => null));
  await registrarAuditoria({ acao: "perfil.senha", modulo: "perfil" });
  return { encerradas };
});
