import { redirect } from "next/navigation";
import { getSessao, primeiraSecaoPath } from "@/lib/sessao";

export default async function ObrigacoesIndex() {
  redirect(primeiraSecaoPath(await getSessao(), "obrigacoes") ?? "/");
}
