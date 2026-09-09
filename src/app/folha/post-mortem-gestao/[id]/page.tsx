import { PaginaRelatorio } from "@/components/postmortem/paginas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PaginaRelatorio modulo="folha" secao="post-mortem-gestao" id={(await params).id} />;
}
