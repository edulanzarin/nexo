"use client";

import { ExploradorNotas } from "@/componentes/produto/notas/explorador-notas";
import { useExecucao } from "@/hooks/use-execucao";

/**
 * O explorador de notas, o mesmo do Fiscal (seção Dados), servido pelo
 * Contábil. Aqui a bancada é de uma empresa só, então a coluna de empresa não
 * aparece.
 */
export default function ConteudoNotas() {
  const { qs } = useExecucao();
  if (!qs) return null;
  return <ExploradorNotas modulo="contabil" qs={qs} />;
}
