import Link from "next/link";
import { Plus } from "lucide-react";
import { listarUsuarios } from "../dados";
import { UsuariosTabela } from "./tabela";

export default async function UsuariosPage() {
  const usuarios = await listarUsuarios();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted">
            {usuarios.length} {usuarios.length === 1 ? "pessoa" : "pessoas"}
          </p>
        </div>
        <Link
          href="/admin/usuarios/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Novo usuário
        </Link>
      </div>

      <div className="mt-6">
        <UsuariosTabela usuarios={usuarios} />
      </div>
    </div>
  );
}
