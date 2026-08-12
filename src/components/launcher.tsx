import Link from "next/link";
import { LogOut } from "lucide-react";
import { MODULOS, type ModuloId } from "@/lib/modulos";
import { sair } from "@/app/login/actions";
import { LogoMarca } from "./logo-marca";
import { ThemeToggle } from "./theme-toggle";
import { Avatar } from "./avatar";
import { ModuloCard } from "./modulo-card";

/**
 * Primeira tela depois do login: escolher o módulo. A grade mostra SEMPRE todos
 * os módulos (mais a Administração) — os que a sessão não libera vêm com cadeado
 * e avisam a falta de permissão ao clicar, em vez de sumir. `acessiveis`/`admin`
 * vêm do perfil no servidor e definem o que abre; o bloqueio real fica nas rotas.
 *
 * Card icônico: o ícone grande é o foco, o título vem abaixo. A descrição não
 * ocupa espaço — fica só no tooltip (title), pra tela respirar.
 */
export function Launcher({
  usuario,
  usuarioId,
  usuarioTemFoto,
  acessiveis,
  admin,
}: {
  usuario: string;
  usuarioId: string;
  usuarioTemFoto: boolean;
  acessiveis: ModuloId[];
  admin: boolean;
}) {
  const acesso = new Set(acessiveis);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <LogoMarca />
        <div className="flex items-center gap-1.5">
          <ThemeToggle label={false} />
          <form action={sair}>
            <button
              type="submit"
              title="Sair"
              className="flex size-9 items-center justify-center rounded-lg border border-hairline text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
        <Link
          href="/perfil"
          title="Meu perfil"
          className="flex w-fit items-center gap-3 rounded-lg -mx-2 px-2 py-1.5 transition-colors hover:bg-surface-2"
        >
          <Avatar id={usuarioId} nome={usuario} temFoto={usuarioTemFoto} size={44} />
          <div>
            <p className="text-sm text-muted">Bem-vindo,</p>
            <p className="text-sm font-semibold">{usuario}</p>
          </div>
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Escolha um módulo</h1>

        {/* Módulos de negócio primeiro (na ordem de MODULOS); Administração vem
            SEMPRE por último e fixa aqui. Módulo novo entra em MODULOS e cai
            antes dela — não mexa nesta ordem. O perfil não é módulo: o acesso é
            pelo bloco de boas-vindas acima (foto clicável). */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {MODULOS.map((m) => (
            <ModuloCard
              key={m.id}
              href={m.home}
              icone={m.icone}
              titulo={m.titulo}
              descricao={m.descricao}
              liberado={acesso.has(m.id)}
            />
          ))}
          <ModuloCard
            href="/admin"
            icone="/images/administracao.png"
            titulo="Administração"
            descricao="Usuários, permissões e grupos de empresa"
            liberado={admin}
          />
        </div>
      </main>
    </div>
  );
}
