import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// Balancete e Análise são abas da seção "analise" e dividem a permissão dela.
// O guarda mora aqui, no servidor: navegar no cliente não refaz o layout.
export default async function Pagina() {
  await assertSecao("contabil", "analise");
  return <Conteudo />;
}
