import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// Tranca real da seção: navegação no cliente não re-roda o layout.
export default async function Page() {
  await assertSecao("contabil", "notas");
  return <Conteudo />;
}
