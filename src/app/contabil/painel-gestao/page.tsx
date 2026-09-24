import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// A tranca da seção mora na página (servidor): navegação no cliente não refaz
// o layout. O colaborador não alcança esta seção nem a rota de API dela.
export default async function Page() {
  await assertSecao("contabil", "painel-gestao");
  return <Conteudo />;
}
