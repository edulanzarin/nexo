import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
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
        <Button asChild variant="primary">
          <Link href="/admin/usuarios/novo">
            <Plus className="size-4" />
            Novo usuário
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <UsuariosTabela usuarios={usuarios} />
      </div>
    </div>
  );
}
