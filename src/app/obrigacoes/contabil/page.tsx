import { assertSecao } from "@/lib/sessao";
import Conteudo from "../conteudo";

export default async function Page() {
  await assertSecao("obrigacoes", "contabil");
  return <Conteudo secao="contabil" />;
}
