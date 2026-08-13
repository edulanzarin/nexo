"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { IconButton } from "@/components/ui";

/**
 * Caixa do LINK PÚBLICO do canal (denúncia ou clima) — para o RH copiar e
 * divulgar (colar no mural, mandar no comunicado). A origem só existe no cliente;
 * `useSyncExternalStore` a lê sem quebrar a hidratação (server rende o caminho,
 * cliente completa a URL).
 */
export function LinkPublico({ caminho }: { caminho: string }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const url = `${origin}${caminho}`;
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível — a URL segue visível */
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-2">
        {url}
      </code>
      <IconButton
        tone="bordered"
        size="sm"
        onClick={copiar}
        aria-label="Copiar link"
        title="Copiar link"
      >
        {copiado ? <Check className="size-4 text-good" /> : <Copy className="size-4" />}
      </IconButton>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:text-ink"
        aria-label="Abrir link"
        title="Abrir em nova aba"
      >
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}
