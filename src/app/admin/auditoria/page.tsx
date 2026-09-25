import { assertAdmin } from "@/lib/sessao";
import Conteudo from "./conteudo";

// A tranca mora na página (servidor): navegação no cliente não refaz o layout.
export default async function Page() {
  await assertAdmin();
  return <Conteudo />;
}
