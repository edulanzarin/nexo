import { assertSecao } from "@/lib/sessao";
import Fila from "../fila";

// A tranca da seção mora na página (servidor): navegação no cliente não refaz o layout.
export default async function Page() {
  await assertSecao("obrigacoes", "fiscal");
  return <Fila secao="fiscal" />;
}
