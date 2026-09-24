import { Suspense } from "react";
import { ProvedorCasca } from "@/componentes/casca/casca-cliente";
import { dadosCasca } from "@/lib/casca-servidor";
import { getSessao } from "@/lib/sessao";
import { Inicio } from "./inicio";

export default async function PaginaInicio() {
  const sessao = await getSessao();
  return (
    <ProvedorCasca dados={dadosCasca(sessao)}>
      <Suspense>
        <Inicio />
      </Suspense>
    </ProvedorCasca>
  );
}
