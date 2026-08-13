import Link from "next/link";
import { Plus } from "lucide-react";
import { listarCargos } from "../dados";
import { CargosTabela } from "./tabela";

export default async function CargosPage() {
  const cargos = await listarCargos();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cargos</h1>
        </div>
        <Link
          href="/admin/cargos/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Novo cargo
        </Link>
      </div>

      <div className="mt-6">
        <CargosTabela cargos={cargos} />
      </div>
    </div>
  );
}
