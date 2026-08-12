import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { assertSecao } from "@/lib/sessao";
import { listarTodasEmpresas } from "@/app/admin/dados";
import { GrupoEmpresaForm } from "../grupo-form";

export default async function NovoGrupoEmpresa() {
  await assertSecao("config", "grupos-empresa");
  const empresas = await listarTodasEmpresas();
  return (
    <div>
      <Link
        href="/config/grupos-empresa"
        className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-3.5" /> Grupos de empresa
      </Link>
      <h1 className="mt-2 mb-6 text-lg font-semibold tracking-tight">Novo grupo</h1>
      <GrupoEmpresaForm grupo={null} empresas={empresas} />
    </div>
  );
}
