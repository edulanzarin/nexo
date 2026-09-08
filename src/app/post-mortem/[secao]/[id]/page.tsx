import { notFound, redirect } from "next/navigation";
import { getSessao, podeSecao } from "@/lib/sessao";
import { listarGruposPostMortem, obterPostMortem } from "@/lib/postmortem";
import { setorPM } from "@/lib/postmortem-setores";
import { FormularioPM } from "./form";

/**
 * O relatório. O caminho carrega a seção de ONDE se entrou (o setor, ou a Geral)
 * — é o que o botão Voltar precisa saber, e é onde a permissão é conferida.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ secao: string; id: string }>;
}) {
  const { secao, id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();

  const sessao = await getSessao();
  const ehGeral = secao === "geral";
  if (!ehGeral && !setorPM(secao)) notFound();

  const coordena = podeSecao(sessao, "postmortem", "geral");
  if (ehGeral ? !coordena : !podeSecao(sessao, "postmortem", secao) && !coordena) {
    redirect("/post-mortem");
  }

  const rel = await obterPostMortem(n);
  if (!rel) notFound();
  // Relatório aberto pelo caminho de OUTRO setor não existe naquele caminho.
  if (!ehGeral && rel.setor !== secao) notFound();

  const ehDono = rel.autorId === sessao.usuario.id;
  // Não-dono só entra pela coordenação (senão nem sabe que existe).
  if (!ehDono && !coordena) notFound();

  const grupos = await listarGruposPostMortem();
  // Edita só o dono e só enquanto rascunho; o resto é leitura.
  return (
    <FormularioPM
      inicial={rel}
      grupos={grupos}
      somenteLeitura={!ehDono || rel.status === "enviado"}
      voltarPara={`/post-mortem/${secao}`}
    />
  );
}
