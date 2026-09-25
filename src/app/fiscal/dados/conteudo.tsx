"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { FiltroEspecies, useEspecies } from "@/componentes/produto/fiscal/filtros";
import { ExploradorNotas } from "@/componentes/produto/notas/explorador-notas";
import { lerContexto } from "@/lib/contexto";
import { useExecucao } from "@/hooks/use-execucao";

/**
 * O explorador de notas, o mesmo do Contábil, servido pelo Fiscal. Aqui o
 * escopo é o escritório, então a coluna de empresa aparece sempre que o recorte
 * executado não é de uma empresa só. A espécie entra na query: a lista, a
 * contraparte e a exportação passam pelo mesmo funil de filtro.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const { comEspecies } = useEspecies();
  if (!qs) return null;
  const umaEmpresa = lerContexto(new URLSearchParams(qs)).empresas.length === 1;
  return (
    <>
      <AcoesPagina>
        <FiltroEspecies />
      </AcoesPagina>
      <ExploradorNotas modulo="fiscal" qs={comEspecies(qs)} mostraEmpresa={!umaEmpresa} />
    </>
  );
}
