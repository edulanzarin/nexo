import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
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
        <Button asChild variant="primary">
          <Link href="/admin/cargos/novo">
            <Plus className="size-4" />
            Novo cargo
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <CargosTabela cargos={cargos} />
      </div>
    </div>
  );
}
