import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { quadroDaEmpresa } from "@/lib/contabil-funcionarios";

/** Quadro de funcionários de uma empresa, servido ao Contábil (sem salário). */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const empresa = Number(sp.get("empresa"));
  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);
  return quadroDaEmpresa(empresa, sp.get("desligados") === "1");
});
