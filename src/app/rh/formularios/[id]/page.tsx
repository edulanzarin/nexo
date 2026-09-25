import { notFound } from "next/navigation";
import { assertSecao } from "@/lib/sessao";
import { Conteudo } from "./conteudo";

/**
 * O editor de um formulário tem rota própria (e não um estado da lista) para o
 * link voltar ao mesmo formulário e para o Voltar do navegador sair dele. O
 * caminho cai na aba Formulários, então a seção e a tranca são as dela.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await assertSecao("rh", "formularios");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  // A chave remonta o editor ao trocar de formulário: o rascunho de um não passa para o outro.
  return <Conteudo key={id} id={id} />;
}
