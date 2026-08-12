import { notFound, redirect } from "next/navigation";
import { getSessao, podeSecao } from "@/lib/sessao";
import { listarGruposPostMortem, obterPostMortem } from "@/lib/folha-postmortem";
import { FormularioPM } from "./form";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();

  const sessao = await getSessao();
  const podeGestao = podeSecao(sessao, "folha", "post-mortem-gestao");
  const podeProprio = podeSecao(sessao, "folha", "post-mortem");
  if (!podeGestao && !podeProprio) redirect("/");

  const rel = await obterPostMortem(n);
  if (!rel) notFound();

  const ehDono = rel.autorId === sessao.usuario.id;
  // Não-dono só entra se for gestor (senão nem sabe que existe).
  if (!ehDono && !podeGestao) redirect("/folha/post-mortem");

  const grupos = await listarGruposPostMortem();
  // Edita só o dono e só enquanto rascunho; o resto (enviado, ou gestor lendo) é leitura.
  const somenteLeitura = !ehDono || rel.status === "enviado";

  return <FormularioPM inicial={rel} grupos={grupos} somenteLeitura={somenteLeitura} />;
}
