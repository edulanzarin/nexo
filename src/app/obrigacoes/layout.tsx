import { Suspense } from "react";
import { ModuloSidebar } from "@/components/sidebar";
import { assertAcesso, secoesVisiveis } from "@/lib/sessao";
import { ObrigacoesShell } from "./shell";

function Fallback() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="skeleton h-10 w-48" />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    </div>
  );
}

export default async function ObrigacoesLayout({ children }: { children: React.ReactNode }) {
  // Gate otimista do módulo (a tranca de verdade é o apiRoute). Nega redirecionando.
  const sessao = await assertAcesso("obrigacoes");
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<aside className="w-60 shrink-0 border-r border-hairline bg-surface" />}>
        <ModuloSidebar
          moduloId="obrigacoes"
          visiveis={[...secoesVisiveis(sessao, "obrigacoes")]}
          usuario={{ id: sessao.usuario.id, nome: sessao.usuario.nome, temFoto: sessao.usuario.temAvatar }}
        />
      </Suspense>
      <main className="min-w-0 flex-1">
        <Suspense fallback={<Fallback />}>
          <ObrigacoesShell>{children}</ObrigacoesShell>
        </Suspense>
      </main>
    </div>
  );
}
