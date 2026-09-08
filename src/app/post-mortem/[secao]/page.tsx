import { notFound, redirect } from "next/navigation";
import { getSessao, podeSecao } from "@/lib/sessao";
import { setorPM } from "@/lib/postmortem-setores";
import { ListaGeral } from "./lista-geral";
import { ListaSetor } from "./lista-setor";

/**
 * A seção é o SETOR (ou a Geral) — daí o segmento dinâmico em vez de uma pasta
 * por setor: setor novo é uma entrada no catálogo, não uma pasta a mais aqui.
 */
export default async function Page({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params;
  const sessao = await getSessao();

  if (secao === "geral") {
    if (!podeSecao(sessao, "postmortem", "geral")) redirect("/post-mortem");
    return <ListaGeral />;
  }

  const setor = setorPM(secao);
  if (!setor) notFound();
  const podeCriar = podeSecao(sessao, "postmortem", setor.id);
  // A coordenação entra na seção do setor (e vê o vazio dela, já que a lista é
  // por autor); quem não tem nem uma coisa nem outra volta pra home do módulo.
  if (!podeCriar && !podeSecao(sessao, "postmortem", "geral")) redirect("/post-mortem");

  return <ListaSetor setor={setor.id} podeCriar={podeCriar} />;
}
