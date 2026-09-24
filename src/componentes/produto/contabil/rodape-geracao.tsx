import type { ReactNode } from "react";
import { Icone, type NomeIcone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";

export type EstadoGeracao = "ok" | "atencao" | "perigo";

const ESTADO: Record<EstadoGeracao, { icone: NomeIcone; cor: string }> = {
  ok: { icone: "ok", cor: "text-ok" },
  atencao: { icone: "alerta", cor: "text-atencao" },
  perigo: { icone: "erro", cor: "text-perigo" },
};

/**
 * O fim das telas que geram arquivo para o Questor: o que vai (ou o que falta)
 * ao lado do botão que gera. O recado fica colado no botão porque é ali que a
 * pessoa decide; um aviso lá no topo seria lido depois do clique.
 *
 * `children` leva os parâmetros da geração (filial, por exemplo) e o botão.
 */
export function RodapeGeracao({
  estado,
  mensagem,
  nota,
  children,
  className,
}: {
  estado: EstadoGeracao;
  mensagem: ReactNode;
  /** Ressalva abaixo do recado, em itálico. */
  nota?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const e = ESTADO[estado];
  return (
    <section
      className={cn(
        "nx-vidro flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-painel px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 basis-80 items-start gap-2">
        <Icone nome={e.icone} tamanho={16} className={cn("mt-px", e.cor)} />
        <div className="min-w-0">
          <p className="text-corpo text-tinta">{mensagem}</p>
          {nota && <p className="mt-0.5 text-pequeno text-apagado italic">{nota}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}
