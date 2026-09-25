import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

// O id "dados" é a chave de permissão desde o nexo2; na tela a seção se chama Notas Fiscais.
export default async function Page() {
  await assertSecao("fiscal", "dados");
  return <Conteudo />;
}
