import { PaginaRelatorio } from "@/componentes/produto/postmortem/paginas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PaginaRelatorio modulo="contabil" secao="post-mortem" id={(await params).id} />;
}
