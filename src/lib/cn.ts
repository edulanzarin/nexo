import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * O tailwind-merge só conhece a escala padrão. Sem ensinar a nossa, ele lê
 * `text-leitura` como COR e, diante de `text-tinta` na mesma lista, descarta o
 * tamanho achando que são duas cores brigando: o número do indicador saía no
 * corpo de 13px, sem erro nenhum.
 */
const mesclar = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "pequeno", "corpo", "medio", "titulo", "leitura", "destaque"] }],
      rounded: [{ rounded: ["chip", "controle", "painel", "flutua"] }],
    },
  },
});

/**
 * Junta classes condicionais (clsx) e resolve conflito de Tailwind: a classe do
 * chamador vence a do primitivo de forma previsível, em vez de virar loteria de
 * ordem no CSS.
 */
export function cn(...inputs: ClassValue[]) {
  return mesclar(clsx(inputs));
}
