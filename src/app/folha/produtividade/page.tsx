import { assertSecao } from "@/lib/sessao";
import { Conteudo } from "./conteudo";

export default async function Pagina() {
  await assertSecao("folha", "produtividade");
  return <Conteudo />;
}
