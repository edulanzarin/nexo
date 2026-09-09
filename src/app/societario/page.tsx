import { redirect } from "next/navigation";
import { getSessao, primeiraSecaoPath } from "@/lib/sessao";

export default async function SocietarioIndex() {
  redirect(primeiraSecaoPath(await getSessao(), "societario") ?? "/");
}
