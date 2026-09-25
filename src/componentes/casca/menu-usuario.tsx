"use client";

import { useRouter } from "next/navigation";
import { sair } from "@/app/login/actions";
import { Avatar } from "@/componentes/primitivos/avatar";
import { Icone } from "@/componentes/primitivos/icone";
import { Menu } from "@/componentes/primitivos/menu";
import { cn } from "@/lib/cn";
import { definirTema, usePreferenciaTema } from "./tema";

export interface UsuarioCasca {
  id: string;
  nome: string;
  email: string;
  admin: boolean;
  /** Momento da foto (vai na URL para a troca aparecer sem esperar o cache). Null = sem foto. */
  fotoVersao: number | null;
}

/** Quem está logado, o tema e a saída. */
export function MenuUsuario({ usuario, compacto }: { usuario: UsuarioCasca; compacto?: boolean }) {
  const tema = usePreferenciaTema();
  const router = useRouter();
  const foto = usuario.fotoVersao != null ? `/api/avatar/${usuario.id}?v=${usuario.fotoVersao}` : null;
  const marca = (t: typeof tema) => (tema === t ? "certo" : undefined);
  return (
    <Menu
      lado={compacto ? "right-end" : "top-start"}
      larguraMin={250}
      cabecalho={
        <div className="min-w-0">
          <p className="truncate text-corpo font-[600] text-tinta">{usuario.nome}</p>
          <p className="truncate text-pequeno text-apagado">{usuario.email}</p>
        </div>
      }
      itens={[
        { tipo: "titulo", rotulo: "Tema" },
        { rotulo: "Noite", icone: "noite", detalhe: marca("noite") && "em uso", aoEscolher: () => definirTema("noite") },
        { rotulo: "Dia", icone: "dia", detalhe: marca("dia") && "em uso", aoEscolher: () => definirTema("dia") },
        {
          rotulo: "Igual ao Windows",
          icone: "sistema",
          detalhe: marca("sistema") && "em uso",
          aoEscolher: () => definirTema("sistema"),
        },
        { tipo: "separador" },
        { rotulo: "Meu perfil", icone: "usuario", aoEscolher: () => router.push("/perfil") },
        { rotulo: "Catálogo de componentes", icone: "grade", aoEscolher: () => window.open("/sistema", "_blank") },
        { tipo: "separador" },
        { rotulo: "Sair", icone: "sair", perigo: true, aoEscolher: () => void sair() },
      ]}
      gatilho={(p) => (
        <button
          {...p}
          type="button"
          title={compacto ? usuario.nome : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-controle text-left transition-colors hover:bg-poco",
            compacto ? "justify-center p-1" : "p-1.5"
          )}
        >
          <Avatar nome={usuario.nome} src={foto} tamanho={28} />
          {!compacto && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-corpo font-[580] text-tinta">{usuario.nome}</span>
                <span className="block truncate text-micro text-apagado">{usuario.admin ? "Administrador" : usuario.email}</span>
              </span>
              <Icone nome="opcoes" tamanho={15} className="text-apagado" />
            </>
          )}
        </button>
      )}
    />
  );
}
