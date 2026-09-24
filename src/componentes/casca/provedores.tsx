"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Torradeira } from "@/componentes/primitivos/aviso";

export function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Resultado do Questor vale pelo recorte executado: não refaz ao
            // voltar para a janela, e só uma nova tentativa em caso de falha.
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={cliente}>
      {children}
      <Torradeira />
    </QueryClientProvider>
  );
}
