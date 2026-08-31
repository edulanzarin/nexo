import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// Guard real da seção: navegação client-side não re-roda o layout, então a
// tranca por seção mora aqui (server). Nega redirecionando para o launcher.
export default async function Page() {
  await assertSecao("fiscal", "produtividade");
  return <Conteudo />;
}
