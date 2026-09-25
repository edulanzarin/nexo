import { notFound } from "next/navigation";
import { DP_FAMILIAS, type DpFamilia } from "@/lib/dp-tipos";
import { assertSecao } from "@/lib/sessao";
import { Conteudo } from "./conteudo";

const FAMILIAS = new Set<string>(DP_FAMILIAS.map((f) => f.id));

/**
 * As cinco abas de família são a mesma tela com a família como parâmetro. Uma
 * rota só em vez de cinco pastas: família nova no catálogo (`DP_FAMILIAS`) já
 * tem aba, e a que não está nele é 404.
 */
export default async function Pagina({ params }: { params: Promise<{ familia: string }> }) {
  await assertSecao("folha", "produtividade");
  const { familia } = await params;
  if (!FAMILIAS.has(familia)) notFound();
  // A chave remonta a tela na troca de família: o que é estado local (o modal
  // aberto) não passa de uma aba para a outra.
  return <Conteudo key={familia} familia={familia as DpFamilia} />;
}
