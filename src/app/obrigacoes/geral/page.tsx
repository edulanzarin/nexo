import { assertSecao } from "@/lib/sessao";
import Conteudo from "../conteudo";

export default async function Page() {
  await assertSecao("obrigacoes", "geral");
  return <Conteudo secao="geral" />;
}
