import type { ReactNode } from "react";
import { Icone } from "@/componentes/primitivos/icone";
import { Painel } from "@/componentes/primitivos/painel";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";

/*
 * O que falta para os formulários da experiência saírem: um formulário ligado
 * a cada marco e gestor em cada setor com gente em experiência. Com o banco do
 * app vazio, é a primeira coisa que o RH precisa ver, antes da lista; depois de
 * pronto, o painel some sozinho. Cada passo pendente traz o botão que resolve.
 */

export interface PassoPreparo {
  chave: string;
  feito: boolean;
  titulo: string;
  detalhe: string;
  /** O botão que resolve. Só aparece no passo pendente. */
  acao?: ReactNode;
}

export function PreparoExperiencia({ passos, className }: { passos: PassoPreparo[]; className?: string }) {
  const faltam = passos.filter((p) => !p.feito).length;
  if (faltam === 0) return null;
  return (
    <Painel
      className={className}
      icone="alerta"
      titulo="Preparo dos Envios"
      descricao={`${num(faltam)} de ${num(passos.length)} ${faltam === 1 ? "passo pendente" : "passos pendentes"}`}
      corpo="py-1"
    >
      <ul className="flex flex-col">
        {passos.map((p) => (
          <li key={p.chave} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-linha py-2.5 last:border-0">
            <Icone
              nome={p.feito ? "ok" : "pendente"}
              tamanho={16}
              className={cn("shrink-0", p.feito ? "text-ok" : "text-atencao")}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("text-corpo", p.feito ? "text-tinta-2" : "font-[560] text-tinta")}>{p.titulo}</p>
              <p className="text-pequeno text-apagado">{p.detalhe}</p>
            </div>
            {!p.feito && p.acao}
          </li>
        ))}
      </ul>
    </Painel>
  );
}
