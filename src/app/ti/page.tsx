import { redirect } from "next/navigation";
import { getSessao, primeiraSecaoPath } from "@/lib/sessao";

/**
 * A entrada do módulo cai na primeira seção que a pessoa alcança. O contexto
 * vai junto mesmo sem uso aqui: é ele que a troca de módulo devolve depois.
 */
export default async function EntradaTi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  const destino = primeiraSecaoPath(await getSessao(), "ti") ?? "/";
  redirect(`${destino}${qs.size ? `?${qs}` : ""}`);
}
