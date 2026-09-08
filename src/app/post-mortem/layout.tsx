import { Suspense } from "react";
import { ModuloSidebar } from "@/components/sidebar";
import { assertAcesso, secoesVisiveis } from "@/lib/sessao";
import { PostMortemShell } from "./shell";

function Fallback() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="skeleton h-10 w-48" />
      <div className="mt-5 skeleton h-96 w-full" />
    </div>
  );
}

export default async function PostMortemLayout({ children }: { children: React.ReactNode }) {
  // Gate otimista do módulo (a tranca de verdade é o apiRoute). Nega redirecionando.
  const sessao = await assertAcesso("postmortem");
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<aside className="w-60 shrink-0 border-r border-hairline bg-surface" />}>
        <ModuloSidebar
          moduloId="postmortem"
          visiveis={[...secoesVisiveis(sessao, "postmortem")]}
          usuario={{
            id: sessao.usuario.id,
            nome: sessao.usuario.nome,
            temFoto: sessao.usuario.temAvatar,
          }}
        />
      </Suspense>
      <main className="min-w-0 flex-1">
        <Suspense fallback={<Fallback />}>
          <PostMortemShell>{children}</PostMortemShell>
        </Suspense>
      </main>
    </div>
  );
}
