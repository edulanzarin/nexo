import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { salvarOverride } from "@/lib/implantacao-servico";

/** Salva um casamento confirmado pelo humano — vira override e o sistema aprende. */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as {
    empresa: number;
    chave: string;
    descr?: string | null;
    conta: number | null;
  };
  if (!Number.isInteger(body.empresa)) throw new FilterError("Empresa inválida");
  await assertEmpresaVisivel(body.empresa);
  if (!body.chave?.trim()) throw new FilterError("Conta de origem inválida");
  await salvarOverride(body.empresa, body.chave, body.descr ?? null, body.conta);
  return { ok: true };
});
