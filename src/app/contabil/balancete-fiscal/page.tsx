import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// O guarda da seção mora aqui, no servidor: navegar no cliente não refaz o layout.
export default async function Pagina() {
  await assertSecao("contabil", "balancete");
  return <Conteudo />;
}
