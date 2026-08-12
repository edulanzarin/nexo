import { Suspense } from "react";
import { ModuloSidebar } from "@/components/sidebar";
import { assertAcesso, secoesVisiveis } from "@/lib/sessao";
import { ConfigShell } from "./shell";

function Fallback() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="skeleton h-10 w-48" />
      <div className="mt-6 skeleton h-64 w-full" />
    </div>
  );
}

export default async function ConfigLayout({ children }: { children: React.ReactNode }) {
  // Gate otimista do módulo (a tranca real é o assertSecao das páginas/actions).
  const sessao = await assertAcesso("config");
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<aside className="w-60 shrink-0 border-r border-hairline bg-surface" />}>
        <ModuloSidebar
          moduloId="config"
          visiveis={[...secoesVisiveis(sessao, "config")]}
          usuario={{ id: sessao.usuario.id, nome: sessao.usuario.nome, temFoto: sessao.usuario.temAvatar }}
        />
      </Suspense>
      <main className="min-w-0 flex-1">
        <Suspense fallback={<Fallback />}>
          <ConfigShell>{children}</ConfigShell>
        </Suspense>
      </main>
    </div>
  );
}
