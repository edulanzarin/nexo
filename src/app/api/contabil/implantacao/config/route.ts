import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { resolverConfig, salvarConfig } from "@/lib/implantacao-servico";
import type { ConfigImplantacao } from "@/lib/implantacao-tipos";

/** Config resolvida da empresa (empresa 0 = padrão global). */
export const GET = apiRoute(async (req) => {
  const empresa = Number(req.nextUrl.searchParams.get("empresa"));
  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  if (empresa !== 0) await assertEmpresaVisivel(empresa);
  return resolverConfig(empresa);
});

/** Salva a config da empresa (ou o padrão global quando empresa = 0). */
export const PUT = apiRoute(async (req) => {
  const body = (await req.json()) as { empresa: number; config: ConfigImplantacao };
  if (!Number.isInteger(body.empresa)) throw new FilterError("Empresa inválida");
  if (body.empresa !== 0) await assertEmpresaVisivel(body.empresa);
  await salvarConfig(body.empresa, body.config);
  return { ok: true };
});
