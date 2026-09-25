import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MarcaNavex } from "./marca";

/**
 * A moldura das páginas abertas do RH: o formulário por link, a denúncia, o
 * acompanhamento e a avaliação de clima. Quem chega aqui não tem conta, veio
 * de um e-mail ou de um QR no mural, e quase sempre está no celular: uma coluna
 * estreita, sem barra lateral nem contexto, e a marca só para dizer de onde é.
 */
export function CascaPublica({
  children,
  className,
  embutida,
}: {
  children: ReactNode;
  className?: string;
  /** No catálogo: sem a altura da tela inteira. */
  embutida?: boolean;
}) {
  // Dentro do catálogo já existe um main: a moldura embutida não abre outro.
  const Corpo = embutida ? "div" : "main";
  return (
    <div className={cn("px-4", embutida ? "py-6" : "min-h-dvh pt-8 pb-14 sm:pt-14")}>
      <Corpo className={cn("mx-auto flex w-full max-w-2xl flex-col gap-5", className)}>
        <p className="flex items-center gap-2.5 text-corpo text-apagado">
          <MarcaNavex tamanho={16} />
          <span>RH da Navecon</span>
        </p>
        {children}
      </Corpo>
    </div>
  );
}

/**
 * Página aberta que não tem o que mostrar: link vencido, formulário já
 * respondido, rodada encerrada, envio concluído. Diz o que houve e o que fazer.
 */
export function AvisoPublico({
  titulo,
  texto,
  tom = "neutro",
  children,
}: {
  titulo: string;
  texto: ReactNode;
  tom?: "neutro" | "ok";
  children?: ReactNode;
}) {
  return (
    <section className="nx-vidro flex flex-col items-center gap-2 rounded-painel px-6 py-10 text-center">
      <h1 className={cn("nx-titulo text-[20px] leading-7", tom === "ok" ? "text-ok" : "text-tinta")}>{titulo}</h1>
      <p className="max-w-md text-corpo text-apagado">{texto}</p>
      {children && <div className="mt-3 w-full">{children}</div>}
    </section>
  );
}
