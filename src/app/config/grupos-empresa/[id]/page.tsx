import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { assertSecao } from "@/lib/sessao";
import { listarTodasEmpresas } from "@/app/admin/dados";
import { carregarGrupoEmpresa } from "@/lib/grupos-empresa";
import { GrupoEmpresaForm } from "../grupo-form";

export default async function EditarGrupoEmpresa({ params }: { params: Promise<{ id: string }> }) {
  await assertSecao("config", "grupos-empresa");
  const { id } = await params;
  const [grupo, empresas] = await Promise.all([
    carregarGrupoEmpresa(Number(id)),
    listarTodasEmpresas(),
  ]);
  if (!grupo) notFound();

  return (
    <div>
      <Link
        href="/config/grupos-empresa"
        className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-3.5" /> Grupos de empresa
      </Link>
      <h1 className="mt-2 mb-6 text-lg font-semibold tracking-tight">{grupo.nome}</h1>
      <GrupoEmpresaForm grupo={grupo} empresas={empresas} />
    </div>
  );
}
