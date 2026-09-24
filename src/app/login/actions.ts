"use server";

import { redirect } from "next/navigation";
import { appQuery } from "@/lib/app-db";
import { criarSessao, destruirSessao, verificarSenha } from "@/lib/auth";

export interface EstadoLogin {
  erro?: string;
  email?: string;
}

/**
 * Entrar. O erro é sempre o mesmo para e-mail inexistente e senha errada: a
 * tela não confirma para ninguém quem tem conta.
 */
export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe o e-mail e a senha.", email };

  let usuario: { id: string; senha_hash: string } | undefined;
  try {
    [usuario] = await appQuery<{ id: string; senha_hash: string }>(
      `select id, senha_hash from usuario where lower(email) = $1 and ativo`,
      [email]
    );
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Banco do app fora do ar.", email };
  }
  if (!usuario || !(await verificarSenha(senha, usuario.senha_hash))) {
    return { erro: "E-mail ou senha não conferem.", email };
  }

  await criarSessao(usuario.id);
  const destino = String(form.get("destino") ?? "");
  redirect(destino.startsWith("/") && !destino.startsWith("//") ? destino : "/");
}

export async function sair(): Promise<void> {
  await destruirSessao();
  redirect("/login");
}
