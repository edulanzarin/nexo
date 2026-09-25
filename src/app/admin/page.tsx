import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/sessao";

export default async function EntradaAdmin() {
  await assertAdmin();
  redirect("/admin/usuarios");
}
