import { redirect } from "next/navigation";
import { getSessao, primeiraSecaoPath } from "@/lib/sessao";

export default async function PostMortemIndex() {
  redirect(primeiraSecaoPath(await getSessao(), "postmortem") ?? "/");
}
