import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { casarPdf } from "@/lib/implantacao-servico";

const MAX_BYTES = 15 * 1024 * 1024;

/** PDF do balancete → linhas casadas contra o plano da empresa (com resumo). */
export const POST = apiRoute(async (req) => {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const empresa = Number(form.get("empresa"));
  const senha = (form.get("senha") as string | null)?.trim() || undefined;

  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);
  if (!(arquivo instanceof File)) throw new FilterError("Envie o PDF do balancete");
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
    throw new FilterError("O balancete precisa ser um PDF");
  }
  if (arquivo.size > MAX_BYTES) throw new FilterError("Arquivo muito grande (máx. 15 MB)");

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const casadas = await casarPdf(empresa, bytes, senha);
  const resumo = {
    total: casadas.length,
    casadas: casadas.filter((c) => c.status === "casada").length,
    duvidosas: casadas.filter((c) => c.status === "duvidosa").length,
    semConta: casadas.filter((c) => c.status === "sem_conta").length,
  };
  return { arquivo: arquivo.name, casadas, resumo };
});
