import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { listarSetores } from "../dados";
import { SetoresTabela } from "./tabela";

export default async function SetoresPage() {
  const setores = await listarSetores();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Setores</h1>
        </div>
        <Button asChild variant="primary">
          <Link href="/admin/setores/novo">
            <Plus className="size-4" />
            Novo setor
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <SetoresTabela setores={setores} />
      </div>
    </div>
  );
}
