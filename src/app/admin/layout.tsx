import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, LogOut, User } from "lucide-react";
import { assertAdmin } from "@/lib/sessao";
import { sair } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { MARCA } from "@/lib/marca";

/**
 * Área administrativa: fora do catálogo de módulos de negócio, só para admin.
 * O gate real é `assertAdmin` aqui e no `apiRoute`/actions; a casca abaixo é a
 * navegação.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await assertAdmin();

  const link = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface px-3 py-5">
        <Link href="/" className="flex items-center gap-1.5 px-2 text-xs text-muted transition-colors hover:text-ink">
          <ChevronLeft className="size-3.5" />
          Voltar ao Hub
        </Link>

        <div className="mt-3 flex items-center gap-2.5 px-2">
          <Image src="/images/administracao.png" alt="" width={32} height={32} className="size-8" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Administração</p>
            <p className="text-[11px] text-muted">{MARCA}</p>
          </div>
        </div>

        <AdminNav />

        <div className="mt-2 flex flex-col gap-0.5 border-t border-hairline pt-2">
          <ThemeToggle />
          <Link href="/perfil" className={link}>
            <User className="size-4 shrink-0" />
            Meu perfil
          </Link>
          <form action={sair}>
            <button type="submit" className={`${link} w-full`}>
              <LogOut className="size-4 shrink-0" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
