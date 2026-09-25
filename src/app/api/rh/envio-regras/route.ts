import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import {
  atualizarRegra,
  criarRegra,
  excluirRegra,
  listarRegras,
  type EnvioRegraEntrada,
} from "@/lib/envio-regras";
import { getSessaoOpcional } from "@/lib/sessao";

/** Regras de envio automático recorrente. GET lista; POST cria; PUT edita (?id=);
 *  DELETE remove (?id=). */
export const GET = apiRoute(() => listarRegras());

export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as EnvioRegraEntrada;
  const sessao = await getSessaoOpcional();
  return criarRegra(body, sessao?.usuario.id ?? null);
});

export const PUT = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("ID inválido");
  const body = (await req.json()) as EnvioRegraEntrada;
  return atualizarRegra(id, body);
});

export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("ID inválido");
  await excluirRegra(id);
  return { ok: true };
});
