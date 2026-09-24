"use client";

import { toast, Toaster } from "sonner";

/**
 * O canal de recado do app. A tela chama `avisar.ok("Regra salva")`; o verbo do
 * recado é o mesmo do botão que o disparou.
 */
export const avisar = {
  ok: (mensagem: string, descricao?: string) => toast.success(mensagem, { description: descricao }),
  erro: (mensagem: string, descricao?: string) => toast.error(mensagem, { description: descricao }),
  info: (mensagem: string, descricao?: string) => toast(mensagem, { description: descricao }),
};

/** A torradeira, com o vidro do sistema. Montada uma vez, no layout raiz. */
export function Torradeira() {
  return (
    <Toaster
      position="bottom-right"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "nx-flutua flex w-[360px] items-start gap-2.5 rounded-painel px-3.5 py-3 text-corpo text-tinta",
          title: "font-[600]",
          description: "text-pequeno text-apagado",
          success: "[&_[data-icon]]:text-ok",
          error: "[&_[data-icon]]:text-perigo",
          icon: "mt-px",
        },
      }}
    />
  );
}
