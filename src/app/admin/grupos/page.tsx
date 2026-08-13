import Link from "next/link";
import { Plus } from "lucide-react";
import { listarGrupos } from "../dados";
import { GruposTabela } from "./tabela";

export default async function GruposPage() {
  const grupos = await listarGrupos();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Grupos de empresa</h1>
        </div>
        <Link
          href="/admin/grupos/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Novo grupo
        </Link>
      </div>

      <div className="mt-6">
        <GruposTabela grupos={grupos} />
      </div>
    </div>
  );
}
