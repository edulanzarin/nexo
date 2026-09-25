"use client";

import { TelaRotatividade } from "@/componentes/produto/pessoal/tela-rotatividade";
import {
  SeletorEmpresaRh,
  empresasDoFiltroRh,
  rotuloFiltroRh,
  type FiltroEmpresaRh,
} from "@/componentes/produto/rh/empresa-rh";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { nomeEmpresaRh } from "@/lib/rh";

/**
 * Rotatividade da Navecon. O período vem do topo e pede Executar, como no DP;
 * a empresa é escolhida aqui, entre as três do RH, e aplica na hora, do mesmo
 * jeito que os filtros da faixa. O nexo2 não tinha a faixa de filtros no RH.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const [filtro, setFiltro] = useEstadoTela<FiltroEmpresaRh>("empresa", "todas");
  const empresas = empresasDoFiltroRh(filtro);
  const qsRh = qs == null ? null : `${qs}&empresas=${empresas.join(",")}`;
  const uma = filtro !== "todas";

  return (
    <TelaRotatividade
      modulo="rh"
      qs={qsRh}
      empresa={uma ? { codigo: empresas[0], nome: nomeEmpresaRh(empresas[0]) } : { nome: rotuloFiltroRh(filtro) }}
      chaveSelecao={filtro}
      arquivo={uma ? nomeEmpresaRh(empresas[0]).toLowerCase() : "navecon-todas"}
      topo={<SeletorEmpresaRh valor={filtro} onMudar={setFiltro} className="self-start" />}
      rotuloTotal={uma ? "Total da empresa" : "Total das empresas"}
      vazio="Nenhum contrato ativo, admitido ou desligado no período. Confira o período no topo."
    />
  );
}
