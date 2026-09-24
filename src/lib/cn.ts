import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes condicionais (clsx) e resolve conflitos de Tailwind (tailwind-merge).
 *
 * Existe por causa dos primitivos de UI: um componente tem uma classe-base e
 * aceita `className` de fora. Sem merge, `cn("px-3", "px-6")` deixaria as duas
 * no atributo e o vencedor viraria loteria de ordem no CSS; com merge, a classe
 * do chamador ganha de forma previsível. `clsx` sozinho não faz isso.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
