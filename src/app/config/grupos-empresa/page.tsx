import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// A tranca da seção mora na página (servidor): navegação no cliente não refaz o layout.
export default async function Page() {
  await assertSecao("config", "grupos-empresa");
  return <Conteudo />;
}
