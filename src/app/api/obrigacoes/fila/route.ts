import { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { montarPainelObrigacoes } from "@/lib/obrigacoes";
import { setoresDaSecao } from "@/lib/obrigacoes-secoes";
import { getSessaoOpcional, podeSecao } from "@/lib/sessao";
import type { PainelObrigacoes } from "@/lib/obrigacoes-tipos";

/**
 * Fila de entregas do Acessórias, recortada pelo SETOR da seção pedida.
 *
 * As quatro seções batem nesta rota, então o gate do `apiRoute` só garante que a
 * pessoa acessa ALGUMA delas — quem confere a seção pedida é este handler. Sem
 * isso, quem tem só a seção do DP pediria `?secao=contabil` e leria a fila do
 * Contábil.
 */
export const GET = apiRoute(async (req: NextRequest) => {
  const secao = req.nextUrl.searchParams.get("secao")?.trim() ?? "";
  const setores = setoresDaSecao(secao);
  if (setores === undefined) throw new FilterError("Seção inválida");

  const sessao = await getSessaoOpcional();
  if (!sessao || !podeSecao(sessao, "obrigacoes", secao)) {
    throw new FilterError("Seção fora do seu acesso");
  }

  // Visão geral (setores vazio) = sem recorte; as demais, os setores da seção.
  return (await montarPainelObrigacoes(setores.length ? setores : undefined)) satisfies PainelObrigacoes;
});
