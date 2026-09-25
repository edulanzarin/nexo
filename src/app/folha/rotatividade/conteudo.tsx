"use client";

import { TelaRotatividade } from "@/componentes/produto/pessoal/tela-rotatividade";
import { useEmpresas } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";

/**
 * Rotatividade de uma empresa cliente: a empresa vem do contexto do topo, e a
 * tela inteira é a mesma do RH (`TelaRotatividade`).
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const empresa = new URLSearchParams(qs ?? "").get("empresas");
  const empresas = useEmpresas();
  const nome = empresas.data?.find((e) => String(e.codigo) === empresa)?.nome ?? `Empresa ${empresa ?? ""}`;

  return (
    <TelaRotatividade
      modulo="folha"
      qs={qs}
      empresa={{ codigo: Number(empresa), nome }}
      chaveSelecao={empresa}
      arquivo={empresa ?? "empresa"}
      vazio="A empresa não tem contrato ativo, admitido ou desligado no período. Confira a empresa e o período no topo."
    />
  );
}
