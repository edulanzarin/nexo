import { apiRoute } from "@/lib/api-route";
import { getSessaoOpcional } from "@/lib/sessao";
import { marcarResolvida, desmarcarResolvida, FilterError } from "@/lib/rescisoes";

/**
 * Marca (POST) ou desmarca (DELETE) uma rescisão como paga/homologada — o
 * override manual que fecha o item na fila e para os avisos. Chaveado por
 * (empresa, contrato) do Questor; a autoria vem da sessão.
 */

function parChave(body: Record<string, unknown>): { codigoempresa: number; codigofunccontr: number } {
  const codigoempresa = Number(body.codigoempresa);
  const codigofunccontr = Number(body.codigofunccontr);
  if (!Number.isInteger(codigoempresa) || !Number.isInteger(codigofunccontr)) {
    throw new FilterError("Rescisão inválida (empresa/contrato)");
  }
  return { codigoempresa, codigofunccontr };
}

export const POST = apiRoute(async (req) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { codigoempresa, codigofunccontr } = parChave(body);
  const sessao = await getSessaoOpcional();
  await marcarResolvida({
    codigoempresa,
    codigofunccontr,
    resolvidaEm: typeof body.resolvidaEm === "string" ? body.resolvidaEm : null,
    observacao: typeof body.observacao === "string" ? body.observacao.trim() || null : null,
    usuarioId: sessao?.usuario.id ?? null,
  });
  return { ok: true };
});

export const DELETE = apiRoute(async (req) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { codigoempresa, codigofunccontr } = parChave(body);
  await desmarcarResolvida(codigoempresa, codigofunccontr);
  return { ok: true };
});
