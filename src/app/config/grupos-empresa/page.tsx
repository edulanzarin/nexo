import Link from "next/link";
import { Plus } from "lucide-react";
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
        <Link
          href="/config/grupos-empresa/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Novo grupo
        </Link>
      </div>

      <div className="mt-5">
        <GruposEmpresaTabela grupos={grupos} />
      </div>
    </div>
  );
}
