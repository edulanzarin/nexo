import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// Guard da seção no server: mesma seção da aba Saldos ("implantacao" do Contábil).
export default async function Page() {
  await assertSecao("contabil", "implantacao");
  return <Conteudo />;
}
