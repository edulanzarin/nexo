"use client";

import { Loader2, Play } from "lucide-react";
import { useIsFetching } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

/**
 * Botão que aplica os filtros e dispara a consulta — o único gatilho de
 * execução ([[executar-com-botao]]). O rótulo segue a ação real da tela
 * ("Executar" computa, "Carregar" só traz cadastro). Enfatizado quando há
 * mudança pendente (`dirty`); com consulta em andamento vira spinner e trava,
 * para o clique ter resposta visível no próprio botão.
 */
export function BotaoExecutar({
  onClick,
  dirty,
  rotulo = "Executar",
  disabled = false,
  title,
  executando: executandoExterno = false,
}: {
  onClick: () => void;
  dirty: boolean;
  rotulo?: string;
  disabled?: boolean;
  title?: string;
  /** Execução fora do React Query (ex.: POST do extrato) — soma ao spinner. */
  executando?: boolean;
}) {
  // Só consultas de dados contam — as de suporte da própria barra (lista de
  // empresas, contas do plano) não podem fazer o botão girar sozinho no mount.
  const executandoQueries =
    useIsFetching({
      predicate: (q) => q.queryKey[0] !== "empresas" && q.queryKey[0] !== "contas",
    }) > 0;
  const executando = executandoExterno || executandoQueries;
  const travado = disabled || executando;

  return (
    <Button
      variant="primary"
      onClick={onClick}
      disabled={travado}
      title={title}
      className={cn(
        "px-3.5",
        // Sempre ativo: dá pra re-rodar sem mudar filtro. Um anel destaca a
        // mudança pendente (dirty). Execução em andamento vira spinner e trava.
        dirty && !travado && "ring-2 ring-accent/40 ring-offset-2 ring-offset-page",
        executando && "cursor-wait disabled:opacity-80",
        // Desabilitado permanente: sai do gradiente para a superfície neutra.
        disabled &&
          !executando &&
          "cursor-not-allowed bg-none bg-surface-2 text-muted shadow-none disabled:opacity-100"
      )}
    >
      {executando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      {executando ? "Executando…" : rotulo}
    </Button>
  );
}
