import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import {
  carregarEnvio,
  criarEnvio,
  listarEnvios,
  type DestinatarioEntrada,
} from "@/lib/envios";
import { getSessaoOpcional } from "@/lib/sessao";

/** Campanhas de envio. `?id=` traz o detalhe (com respostas); sem id, a lista. */
export const GET = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (Number.isInteger(id) && id > 0) {
    const e = await carregarEnvio(id);
    if (!e) throw new FilterError("Envio não encontrado");
    return e;
  }
  return listarEnvios();
});

/** POST cria e dispara (ou agenda) uma campanha. */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const formularioId = Number(body.formularioId);
  if (!Number.isInteger(formularioId)) throw new FilterError("Escolha um formulário");

  const destinatarios = Array.isArray(body.destinatarios)
    ? (body.destinatarios as DestinatarioEntrada[])
    : [];
  const sessao = await getSessaoOpcional();
  return criarEnvio({
    formularioId,
    titulo: (body.titulo as string) ?? null,
    mensagem: (body.mensagem as string) ?? null,
    destinatarios,
    agendarPara: (body.agendarPara as string) ?? null,
    criadoPor: sessao?.usuario.id ?? null,
  });
});
