import { cn } from "@/lib/cn";
import type { Modulo } from "@/lib/modulos";

/**
 * O ícone do módulo: o cubo com a sigla e a cor dele, o mesmo do nexo2. O
 * Eduardo preferiu manter a identidade que o time já reconhece aos ícones
 * desenhados para o NaveX, que ficaram genéricos. O cubo já traz a cor, então
 * vai sem moldura nem fundo tingido; o PNG tem fundo transparente e serve os
 * dois temas.
 *
 * `<img>` e não `next/image`: são sete arquivos de 7 a 12 KB, já recortados
 * no tamanho, e o otimizador só acrescentaria uma rota no caminho.
 */
export function IconeModulo({
  modulo,
  tamanho = 28,
  className,
}: {
  modulo: Pick<Modulo, "imagem">;
  tamanho?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={modulo.imagem}
      alt=""
      aria-hidden
      width={tamanho}
      height={tamanho}
      draggable={false}
      className={cn("shrink-0 select-none", className)}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}
