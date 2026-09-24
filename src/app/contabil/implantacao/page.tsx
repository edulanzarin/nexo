import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

export default async function PaginaImplantacaoSaldos() {
  await assertSecao("contabil", "implantacao");
  return <Conteudo />;
}
