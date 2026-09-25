import type { Metadata } from "next";
import { Suspense } from "react";
import { ProvedorCasca } from "@/componentes/casca/casca-cliente";
import { dadosCasca } from "@/lib/casca-servidor";
import { getSessao } from "@/lib/sessao";
import Conteudo from "./conteudo";

export const metadata: Metadata = { title: "Meu Perfil" };

/** O perfil de quem está logado. Fora dos módulos: é pessoal, e se chega pelo menu da pessoa. */
export default async function PaginaPerfil() {
  const sessao = await getSessao();
  return (
    <ProvedorCasca dados={dadosCasca(sessao)}>
      <Suspense>
        <Conteudo />
      </Suspense>
    </ProvedorCasca>
  );
}
