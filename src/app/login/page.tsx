import { redirect } from "next/navigation";
import { LogoMarca } from "@/components/logo-marca";
import { getSessaoOpcional } from "@/lib/sessao";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Já logado não vê o login — vai direto ao launcher.
  if (await getSessaoOpcional()) redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <LogoMarca />
        <ThemeToggle label={false} />
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-24">
        <div className="card anim-scale-in px-7 py-8">
          <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted">Acesse a plataforma da Navecon</p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
