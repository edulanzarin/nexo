import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// O plano é uma aba da seção Conferência fiscal e herda a permissão dela.
export default async function Page() {
  await assertSecao("contabil", "conferencia");
  return <Conteudo />;
}
