import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { num } from "@/lib/format";

/**
 * O detalhe de um indicador do time: quanto andou e de quanto partiu. Sem o
 * número de partida, "+300%" pode ser de 1 para 4. Sem período anterior, a
 * variação não se desenha e o detalhe diz isso.
 */
export function ContraAnterior({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior <= 0) return <>Nada no período anterior</>;
  return (
    <>
      <Variacao atual={atual} anterior={anterior} /> · {num(anterior)} no anterior
    </>
  );
}
