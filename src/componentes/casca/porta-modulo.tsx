import Link from "next/link";
import type { ReactNode } from "react";
import { Icone } from "@/componentes/primitivos/icone";
import type { Modulo } from "@/lib/modulos";
import { IconeModulo } from "./modulo";

type ModuloPorta = Pick<Modulo, "imagem" | "titulo" | "descricao">;

/**
 * A porta de um módulo no início: quem ele é e, numa linha, a relação da pessoa
 * com ele (onde parou, ou onde ele abre). Não lista as seções: o mapa delas é a
 * barra lateral de dentro do módulo, e repetido aqui tirava o motivo de entrar.
 * Ir direto a uma tela é trabalho da paleta (Ctrl+K), não de um cardápio.
 *
 * Módulo que ainda não foi refeito não ganha porta: do mesmo tamanho, as
 * fechadas ocupavam mais tela que as abertas. Ele vai numa faixa compacta.
 */
export function PortaModulo({
  modulo,
  href,
  rodape,
}: {
  modulo: ModuloPorta;
  href: string;
  rodape: ReactNode;
}) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <IconeModulo modulo={modulo} tamanho={40} />
        <Icone
          nome="seta-direita"
          tamanho={16}
          className="mt-1 text-apagado transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-tinta"
        />
      </div>
      <div className="min-w-0">
        <h2 className="nx-titulo text-[18px] leading-6 text-tinta">{modulo.titulo}</h2>
        <p className="mt-0.5 line-clamp-2 text-corpo text-apagado">{modulo.descricao}</p>
      </div>
      <p className="mt-auto truncate border-t border-linha pt-2.5 text-pequeno text-apagado">{rodape}</p>
    </>
  );

  return (
    <Link
      href={href}
      className="nx-vidro group flex min-h-[184px] min-w-0 flex-col gap-3 rounded-painel p-4 transition-[border-color] hover:border-linha-forte"
    >
      {conteudo}
    </Link>
  );
}
