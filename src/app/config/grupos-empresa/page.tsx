import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { assertSecao } from "@/lib/sessao";
import { listarGruposEmpresa } from "@/lib/grupos-empresa";
import { GruposEmpresaTabela } from "./tabela";

export default async function Page() {
  await assertSecao("config", "grupos-empresa");
  const grupos = await listarGruposEmpresa();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Grupos de empresa</h2>
        </div>
        <Button asChild variant="primary">
          <Link href="/config/grupos-empresa/novo">
            <Plus className="size-4" />
            Novo grupo
          </Link>
        </Button>
      </div>

      <div className="mt-5">
        <GruposEmpresaTabela grupos={grupos} />
      </div>
    </div>
  );
}
