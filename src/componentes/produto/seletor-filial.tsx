"use client";

import { ComboMulti } from "@/componentes/primitivos/combo";
import { useFiliais } from "@/hooks/use-consulta";

/**
 * Filial da empresa do contexto. Só aparece quando a tela honra filial e há
 * uma empresa; empresa de filial única nem mostra o controle, porque a escolha
 * não existe.
 */
export function SeletorFilial({
  empresa,
  estabs,
  onMudar,
}: {
  empresa: number;
  estabs: number[];
  onMudar: (estabs: number[]) => void;
}) {
  const filiais = useFiliais(empresa);
  const lista = filiais.data ?? [];
  if (lista.length <= 1) return null;
  return (
    <ComboMulti
      rotuloAcessivel="Filial"
      icone="camadas"
      className="w-auto max-w-[220px]"
      rotuloTodas="Todas as filiais"
      plural="filiais"
      opcoes={lista.map((f) => ({ valor: String(f.codigoestab), rotulo: f.nome, detalhe: String(f.codigoestab) }))}
      valor={estabs.map(String)}
      onMudar={(v) => onMudar(v.map(Number))}
    />
  );
}
