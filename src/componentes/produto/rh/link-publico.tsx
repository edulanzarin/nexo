"use client";

import { useState, useSyncExternalStore } from "react";
import { BotaoIcone } from "@/componentes/primitivos/botao";
import { Icone } from "@/componentes/primitivos/icone";
import { avisar } from "@/componentes/primitivos/aviso";
import { cn } from "@/lib/cn";
import { copiarTexto } from "@/lib/copiar";

const semAssinatura = () => () => {};

/**
 * O endereço aberto de um canal do RH (denúncia, avaliação de clima), para
 * copiar e divulgar no mural ou no comunicado. A origem só existe no navegador:
 * o servidor desenha o caminho e o cliente completa, sem quebrar a hidratação.
 */
export function LinkPublico({ caminho, className }: { caminho: string; className?: string }) {
  const origem = useSyncExternalStore(semAssinatura, () => window.location.origin, () => "");
  const url = `${origem}${caminho}`;
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (await copiarTexto(url)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } else avisar.erro("Não deu para copiar", "Selecione o endereço e copie com Ctrl+C.");
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <code className="num h-controle min-w-0 flex-1 truncate rounded-controle border border-linha bg-poco px-2.5 text-pequeno block leading-[30px] text-tinta-2 select-all">
        {url}
      </code>
      <BotaoIcone
        icone={copiado ? "certo" : "copiar"}
        rotulo={copiado ? "Copiado" : "Copiar endereço"}
        variante="secundario"
        onClick={copiar}
      />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="Abrir em outra aba"
        aria-label="Abrir em outra aba"
        className="grid size-controle shrink-0 place-items-center rounded-controle border border-linha text-apagado transition-colors hover:border-linha-forte hover:text-tinta"
      >
        <Icone nome="sobe-direita" tamanho={15} />
      </a>
    </div>
  );
}
