import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

export default async function PaginaRegrasExtrato() {
  await assertSecao("contabil", "conciliacao");
  return <Conteudo />;
}
