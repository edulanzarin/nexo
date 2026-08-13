import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
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
        <Button asChild variant="primary">
          <Link href="/admin/grupos/novo">
            <Plus className="size-4" />
            Novo grupo
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <GruposTabela grupos={grupos} />
      </div>
    </div>
  );
}
