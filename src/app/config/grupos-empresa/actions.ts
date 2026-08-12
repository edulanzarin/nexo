"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertSecao } from "@/lib/sessao";
import {
  salvarGrupoEmpresa as salvarGrupoLib,
  excluirGrupoEmpresa as excluirGrupoLib,
} from "@/lib/grupos-empresa";

export async function salvarGrupoEmpresa(formData: FormData): Promise<void> {
  await assertSecao("config", "grupos-empresa");
  const id = Number(formData.get("id"));
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Dê um nome ao grupo");
  const empresas = formData
    .getAll("empresas")
    .map((e) => Number(e))
    .filter(Number.isInteger);

  await salvarGrupoLib({
    id: Number.isInteger(id) && id > 0 ? id : undefined,
    nome,
    empresas,
  });

  revalidatePath("/config/grupos-empresa");
  redirect("/config/grupos-empresa");
}

export async function excluirGrupoEmpresa(formData: FormData): Promise<void> {
  await assertSecao("config", "grupos-empresa");
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) await excluirGrupoLib(id);

  revalidatePath("/config/grupos-empresa");
  redirect("/config/grupos-empresa");
}
