import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./icone";

/**
 * Caixa de marcar desenhada: a nativa não segue o tema, e o visto dela some no
 * escuro. O input real continua lá, invisível, para teclado e leitor de tela.
 */
export function Caixa({
  marcada,
  indeterminada,
  onMudar,
  rotulo,
  detalhe,
  desabilitada,
  className,
  onClickCapture,
}: {
  marcada: boolean;
  indeterminada?: boolean;
  onMudar: (marcada: boolean) => void;
  rotulo?: ReactNode;
  detalhe?: ReactNode;
  desabilitada?: boolean;
  className?: string;
  /** Para ler o Shift+clique antes da mudança (seleção por intervalo). */
  onClickCapture?: (e: React.MouseEvent) => void;
}) {
  const ligada = marcada || indeterminada;
  return (
    <label
      onClickCapture={onClickCapture}
      className={cn(
        "inline-flex min-w-0 cursor-pointer items-center gap-2 text-corpo text-tinta-2 select-none",
        desabilitada && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={marcada}
        disabled={desabilitada}
        aria-checked={indeterminada ? "mixed" : marcada}
        onChange={(e) => onMudar(e.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--anel)]",
          ligada ? "border-rota bg-rota text-fundo" : "border-linha-forte bg-poco"
        )}
      >
        {indeterminada ? (
          <span className="h-0.5 w-2 rounded bg-current" />
        ) : marcada ? (
          <Icone nome="certo" tamanho={14} className="size-3" />
        ) : null}
      </span>
      {(rotulo || detalhe) && (
        <span className="min-w-0">
          {rotulo && <span className="block truncate">{rotulo}</span>}
          {detalhe && <span className="block truncate text-pequeno text-apagado">{detalhe}</span>}
        </span>
      )}
    </label>
  );
}

/** Liga e desliga algo que vale na hora (sem botão de salvar). */
export function Alternador({
  ligado,
  onMudar,
  rotulo,
  desabilitado,
  className,
}: {
  ligado: boolean;
  onMudar: (ligado: boolean) => void;
  rotulo?: ReactNode;
  desabilitado?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-corpo text-tinta-2 select-none",
        desabilitado && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={ligado}
        disabled={desabilitado}
        onChange={(e) => onMudar(e.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          "relative h-[18px] w-8 shrink-0 rounded-full border transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--anel)]",
          ligado ? "border-rota bg-rota" : "border-linha-forte bg-poco-forte"
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] left-[2px] size-3 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-mola)]",
            ligado && "translate-x-[14px]"
          )}
        />
      </span>
      {rotulo && <span>{rotulo}</span>}
    </label>
  );
}
