import { assertSecao } from "@/lib/sessao";
import { Conteudo } from "./conteudo";

export default async function Pagina() {
  await assertSecao("contabil", "produtividade");
  return <Conteudo />;
}
