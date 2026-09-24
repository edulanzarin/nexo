"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icone";

/**
 * Área de soltar arquivo. É a porta de entrada das telas que executam pelo
 * arquivo (extrato, balancete em PDF): por isso é grande quando vazia e vira
 * uma linha quando já há arquivo lido.
 */
export function ZonaArquivo({
  aceita,
  multiplo,
  onArquivos,
  titulo = "Solte o arquivo aqui",
  descricao,
  icone = "enviar-arquivo",
  desabilitada,
  carregando,
  compacta,
  className,
  extra,
}: {
  /** Extensões aceitas: ".ofx,.pdf". */
  aceita: string;
  multiplo?: boolean;
  onArquivos: (arquivos: File[]) => void;
  titulo?: ReactNode;
  descricao?: ReactNode;
  icone?: NomeIcone;
  desabilitada?: boolean;
  carregando?: boolean;
  compacta?: boolean;
  className?: string;
  extra?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const extensoes = aceita.split(",").map((e) => e.trim().toLowerCase());
  const aceitar = (lista: FileList | null) => {
    if (!lista || desabilitada || carregando) return;
    const arquivos = [...lista].filter((f) => extensoes.some((e) => f.name.toLowerCase().endsWith(e)));
    if (arquivos.length) onArquivos(multiplo ? arquivos : arquivos.slice(0, 1));
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSobre(false);
        aceitar(e.dataTransfer.files);
      }}
      className={cn(
        "relative flex rounded-painel border border-dashed transition-colors",
        compacta ? "items-center gap-3 px-4 py-3" : "flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        sobre ? "border-rota bg-rota-suave" : "border-linha-forte bg-poco",
        (desabilitada || carregando) && "opacity-60",
        className
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full border border-linha bg-vidro-forte text-apagado",
          compacta ? "size-8" : "size-11"
        )}
      >
        <Icone nome={carregando ? "carregando" : icone} tamanho={compacta ? 16 : 20} />
      </span>
      <div className={cn("min-w-0", compacta && "flex-1")}>
        <p className="text-medio font-[600] text-tinta">{titulo}</p>
        {descricao && <p className="text-corpo text-apagado">{descricao}</p>}
      </div>
      <button
        type="button"
        disabled={desabilitada || carregando}
        onClick={() => input.current?.click()}
        className={cn(
          "h-controle rounded-controle border border-linha-forte bg-vidro-forte px-3 text-corpo font-[560] text-tinta hover:bg-poco-forte",
          !compacta && "mt-2"
        )}
      >
        Escolher arquivo
      </button>
      {extra}
      <input
        ref={input}
        type="file"
        accept={aceita}
        multiple={multiplo}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          aceitar(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
