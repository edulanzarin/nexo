"use client";

import { Segmentado } from "@/componentes/primitivos/abas";

/*
 * O lado da nota: entrada (o que a empresa comprou ou recebeu) ou saída (o que
 * vendeu ou mandou). Quase todo número do Fiscal existe dos dois lados, e a cor
 * do lado é fixa no módulo inteiro: a barra azul de um ranking e a área azul da
 * série falam da mesma coisa, sem legenda para decorar.
 */

export type Lado = "ent" | "sai";

export const COR_LADO: Record<Lado, string> = {
  ent: "var(--ent)",
  sai: "var(--sai)",
};

export const ROTULO_LADO: Record<Lado, string> = {
  ent: "Entradas",
  sai: "Saídas",
};

/** Entradas ou saídas, no cabeçalho do painel que mede um lado só. */
export function SeletorLado({ lado, onMudar }: { lado: Lado; onMudar: (lado: Lado) => void }) {
  return (
    <Segmentado
      rotulo="Entradas ou saídas"
      opcoes={[
        { valor: "ent", rotulo: ROTULO_LADO.ent },
        { valor: "sai", rotulo: ROTULO_LADO.sai },
      ]}
      valor={lado}
      onMudar={onMudar}
    />
  );
}
