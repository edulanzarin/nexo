import { assertSecao } from "@/lib/sessao";
import Conteudo from "./conteudo";

export default async function PaginaImportarExtrato() {
  await assertSecao("contabil", "conciliacao");
  return <Conteudo />;
}
