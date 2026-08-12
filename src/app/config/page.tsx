import { redirect } from "next/navigation";
import { getSessao, primeiraSecaoPath } from "@/lib/sessao";

// Home do módulo: cai na 1ª seção que a sessão pode ver (mesmo padrão dos outros).
export default async function ConfigIndex() {
  const home = primeiraSecaoPath(await getSessao(), "config") ?? "/";
  redirect(home);
}
