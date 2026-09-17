import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { lerPatrimonialPdf } from "@/lib/patrimonial-servico";

const MAX_BYTES = 15 * 1024 * 1024;

/** PDF do relatório de bens → bens lidos + contas casadas com o plano da empresa. */
export const POST = apiRoute(async (req) => {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const empresa = Number(form.get("empresa"));
  const senha = (form.get("senha") as string | null)?.trim() || undefined;

  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);
  if (!(arquivo instanceof File)) throw new FilterError("Envie o PDF do relatório de bens");
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
    throw new FilterError("O relatório de bens precisa ser um PDF");
  }
  if (arquivo.size > MAX_BYTES) throw new FilterError("Arquivo muito grande (máx. 15 MB)");

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const leitura = await lerPatrimonialPdf(empresa, bytes, senha);
  return { arquivo: arquivo.name, ...leitura };
});
